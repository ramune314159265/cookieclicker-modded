main();

function main() {
	if (!Game.ready) {
		setTimeout(main, 100);
		return;
	}
	const defaultSettingsString = "0,1,1,1,0,0.1,1";
	const defaultSettings = defaultSettingsString.split(",");

	let advisorSettingsString = localStorage.getItem("assistantSettings")
		? localStorage.getItem("assistantSettings")
		: defaultSettingsString;
	let advisorSettings = advisorSettingsString.split(",");

	if (advisorSettings.length !== defaultSettings.length) advisorSettings = [...defaultSettings];

	function getSettingBool(index) {
		return advisorSettings[index] !== undefined ? advisorSettings[index] === "1" : defaultSettingsString[index] === "1";
	}

	function getSettingNumber(index) {
		return advisorSettings[index] !== undefined ? Number(advisorSettings[index]) : Number(defaultSettingsString[index]);
	}

	const options = {
		buildingsOnly: {
			value: getSettingBool(0),
			name: "建物のみ",
			description: "アップグレードを計算から除外します",
		},
		checkForFaster: {
			value: getSettingBool(1),
			name: "より素早い計算",
			description: "より高速な方法で計算を行います (オン推奨、パフォーマンスが改善可能性あり)",
		},
		accountForWrinklers: {
			value: getSettingBool(2),
			name: "シワシワ虫を計算",
			description: "シワシワ虫のCpS増加を計算に考慮します (オン推奨)",
		},
		stockMarketTooltips: {
			value: getSettingBool(3),
			name: "株式市場に情報を追加",
			description: "株式市場に情報を追加します (再読み込みが必要な可能性あり)",
		},
		debugMode: {
			value: getSettingBool(4),
			name: "デバックモード",
			description: "コンソールにデバックログを出力します (オフ推奨)",
		},
		updateInterval: {
			value: getSettingNumber(5),
			name: "更新頻度",
			description: "Advisorがどのぐらいの頻度で更新するかを変更します (デフォルト 0.1秒)",
		},
		highlightBestPurchase: {
			value: getSettingBool(6),
			name: "最適なアップグレード、建物をハイライト",
			description: "最適なアップグレード、建物をハイライトします",
		},
	};

	// Shop tips container
	const shopTips = document.createElement("div");
	shopTips.id = "shopTips";

	const background = document.createElement("div");
	background.id = "shopTipsBackground";
	shopTips.appendChild(background);

	// Tips
	const fastest = document.createElement("div");
	fastest.id = "fast";
	fastest.innerHTML = "";
	background.appendChild(fastest);

	const best = document.createElement("div");
	best.id = "best";
	best.innerHTML = "";
	background.appendChild(best);

	// insert to document
	document.getElementById("store").insertBefore(shopTips, document.getElementById("upgrades"));

	// variables
	let unbuffedCpsMult = 0;
	let wrinklerBuffedCps = 0;
	let wrinklerThinAirCookieBoost = 0;
	let wrinklerNumber = 0;
	let wrinklerCookies = 0;

	let highlight;
	let previousHighlight;

	// debug
	let previousTotalCps = -1;
	let previousObjectsCps = [];
	let previousObjectAmounts = [];
	let previousUpgradesBought = [];
	let previousUpgradesOwned = 0;

	console.log("Done Initializing Advisor!");

	// for (const key in Game.Upgrades) {
	// 	const upgrade = Game.Upgrades[key];
	// 	if (getUpgradeCps(upgrade) === -69) {
	// 		upgrade.unlocked = 1;
	// 		upgrade.bought = 0;
	// 	} else {
	// 		upgrade.unlocked = 1;
	// 		upgrade.bought = 1;
	// 	}
	// }

	// start timers
	updateTimer();
	frameTimer();

	function updateTimer() {
		update();
		if (previousTotalCps !== Game.unbuffedCps) {
			if (options.debugMode.value) {
				debug();
			}
		}

		setTimeout(updateTimer, options.updateInterval.value * 1000);
	}

	function debug() {
		let isBuilding = false;
		let lastPurchase = -1;
		for (let i = 0; i < Game.ObjectsById.length; i++) {
			const object = Game.ObjectsById[i];

			if (object.amount - previousObjectAmounts[i] === 1) {
				lastPurchase = i;
				isBuilding = true;
			}
			previousObjectAmounts[i] = object.amount;
		}

		if (!isBuilding) {
			if (Game.UpgradesOwned - previousUpgradesOwned === 1) {
				for (let id = 0; id < Game.UpgradesN; id++) {
					if (Game.UpgradesById[id].bought === 1 && previousUpgradesBought[id] === 0) {
						lastPurchase = id;
					}
				}
			}
		}

		previousUpgradesOwned = Game.UpgradesOwned;
		for (let id = 0; id < Game.UpgradesN; id++) {
			previousUpgradesBought[id] = Game.UpgradesById[id].bought;
		}

		let total = Game.unbuffedCps - previousTotalCps;
		let expected = -1;

		if (lastPurchase !== -1) {
			if (isBuilding) {
				Game.ObjectsById[lastPurchase].amount -= 1;
				Game.CalculateGains();
				expected = getBuildingCps(Game.ObjectsById[lastPurchase]);
				Game.ObjectsById[lastPurchase].amount += 1;
				Game.CalculateGains();
			} else {
				Game.UpgradesById[lastPurchase].bought = 0;
				Game.CalculateGains();
				expected = getUpgradeCps(Game.UpgradesById[lastPurchase]);
				Game.UpgradesById[lastPurchase].bought = 1;
				Game.CalculateGains();
			}
		}

		// log data
		//const logData = expected != -1 && Math.abs(expected / total - 1) > 0.001;
		const logData = true;

		if (logData) {
			console.log("---------------------------------------");

			if (lastPurchase !== -1) {
				if (isBuilding) {
					console.log("Building: " + Game.ObjectsById[lastPurchase].name);
				} else {
					console.log("Upgrade: " + Game.UpgradesById[lastPurchase].name);
				}
			}
		}

		for (let i = 0; i < Game.ObjectsById.length; i++) {
			const object = Game.ObjectsById[i];

			const previousCps = previousObjectsCps[i];
			const cps = object.storedTotalCps * unbuffedCpsMult;

			if (cps - previousCps !== 0) {
				if (logData) console.log(object.name + ": " + Beautify(cps - previousCps));
			}

			previousObjectsCps[i] = cps;
		}

		if (logData) {
			console.log("Total: " + Beautify(Game.unbuffedCps - previousTotalCps));

			// not exact calc
			if (expected != -1)
				if (Math.abs(expected / total - 1) > 0.001) {
					console.log("Expected: " + Beautify(expected));
					console.log("Error: " + Math.round(Math.abs(expected / total - 1) * 1000) / 10 + "%");
				}
		}

		previousTotalCps = Game.unbuffedCps;
	}

	function frameTimer() {
		updateOtherUI();
		setTimeout(frameTimer, 1000 / Game.fps);
	}

	function createToggleOption(name) {
		const option = options[name];
		const optionHTML = document.createElement("div");

		// Button
		const button = document.createElement("a");
		button.id = name + "Button";
		button.className = "smallFancyButton prefButton option" + (option.value ? "" : " off");
		eval(
			`Game.func = function () {toggleOption("${name}");
		PlaySound("sounds/tick.mp3"); };`
		);
		button.onclick = Game.func;
		button.innerHTML = option.name + " " + (option.value ? "ON" : "OFF");

		// Text
		const text = document.createElement("label");
		text.innerHTML = "(" + option.description + ")";
		text.className = "optionDescription";

		optionHTML.appendChild(button);
		optionHTML.appendChild(text);

		return optionHTML;
	}

	function createSliderOption(name, valueText, min, max, step) {
		const option = options[name];

		eval(
			`Game.func = function () {
			var n = Number(l('${name}Slider').value)
			sliderOption('${name}', n);
			l('${name}SliderRightText').innerHTML = valueText.replace("[$]", n);
		};`
		);

		const slider = document.createElement("input");
		slider.className = "slider";
		slider.style = "clear:both;";
		slider.type = "range";
		slider.min = min;
		slider.max = max;
		slider.step = step;
		slider.onchange = Game.func;
		slider.oninput = Game.func;
		slider.onmouseup = "PlaySound('sounds/tick.mp3');";
		slider.id = name + "Slider";
		slider.value = option.value;

		const optionHTML = document.createElement("div");
		optionHTML.className = "sliderBox";
		optionHTML.innerHTML =
			`<div style="float:left;" class="smallFancyButton">${option.name}</div>` +
			`<div style="float:right;" class="smallFancyButton" id="${name + "SliderRightText"}">${valueText.replace(
				"[$]",
				option.value
			)}</div>`;
		optionHTML.appendChild(slider);

		return optionHTML;
	}

	async function waitForPrompt() {
		while (true) {
			if (Game.hasAnsweredPrompt) {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	async function toggleOption(name) {
		Game.hasAnsweredPrompt = false;
		if (name === "debugMode" && !options[name].value) {
			Game.Prompt(
				"<id RequiresConfirmation>" +
					'<div class="block">' +
					loc(
						"<b>Warning:</b> Enabling this may course unwanted edits to your save! Do not enable this on your personal save!</small><br><br>Enable?"
					) +
					"</div>",
				[
					[loc("Yes"), "Game.answerFromPrompt = true; Game.hasAnsweredPrompt = true; Game.ClosePrompt();"],
					[loc("No"), "Game.answerFromPrompt = false; Game.hasAnsweredPrompt = true; Game.ClosePrompt();"],
				]
			);
			await waitForPrompt();
			if (Game.answerFromPrompt == false) return;
		}

		// toggle
		const option = options[name];
		option.value = !option.value;
		const button = document.getElementById(name + "Button");
		button.className = "smallFancyButton prefButton option" + (option.value ? "" : " off");
		button.innerHTML = option.name + " " + (option.value ? "ON" : "OFF");

		saveSettings();
	}

	function sliderOption(name, value) {
		const option = options[name];
		option.value = value;

		saveSettings();
	}

	function saveSettings() {
		// save
		let data = "";
		for (const object in options) {
			var value = options[object]["value"];
			if (typeof value == "boolean") data += value == true ? "1" : "0";
			else if (typeof value == "number") data += value;
			else console.log(typeof value);

			data += ",";
		}
		data = data.slice(0, -1);

		localStorage.setItem("assistantSettings", data);
	}

	function updateOtherUI() {
		if (Game.onMenu == "prefs") {
			if (!document.getElementById("shopTipsSettings")) {
				const optionsSection = document.getElementById("menu");
				optionsSection.removeChild(optionsSection.childNodes[optionsSection.childNodes.length - 1]);

				const block = document.createElement("div");
				block.className = "block";
				block.style = "padding:0px;margin:8px 4px;";
				optionsSection.appendChild(block);

				const subsection = document.createElement("div");
				subsection.className = "subsection";
				subsection.style = "padding:0px";
				block.appendChild(subsection);

				const sectionTitle = document.createElement("div");
				sectionTitle.className = "title";
				sectionTitle.innerHTML = "Advisorの設定";
				subsection.appendChild(sectionTitle);

				const advisorSettings = document.createElement("div");
				advisorSettings.id = "shopTipsSettings";
				advisorSettings.className = "listing";

				advisorSettings.appendChild(createToggleOption("buildingsOnly"));
				advisorSettings.appendChild(createToggleOption("checkForFaster"));
				advisorSettings.appendChild(createToggleOption("accountForWrinklers"));
				advisorSettings.appendChild(createToggleOption("stockMarketTooltips"));
				advisorSettings.appendChild(createToggleOption("highlightBestPurchase"));
				advisorSettings.appendChild(createToggleOption("debugMode"));
				advisorSettings.appendChild(createSliderOption("updateInterval", "[$]s", 0.01, 1, 0.01));

				subsection.appendChild(advisorSettings);

				const padding = document.createElement("div");
				padding.style = "padding-bottom:128px;";
				optionsSection.appendChild(padding);
			}
		}

		// Stockmarket tooltip
		if (options.stockMarketTooltips.value) {
			if (Game.Objects["Bank"].onMinigame) {
				const stockMarket = Game.Objects["Bank"].minigame;
				const bigStyle =
					"margin:1px 0px;display:block;font-size:10px;width:100%;background:linear-gradient(to right,transparent,#333,#333,transparent);padding:2px 0px;overflow:hidden;white-space:nowrap;";

				for (let id = 0; id < stockMarket.goodsById.length; id++) {
					const element = document.getElementById("bankGood-" + id);

					const restingValue = 10 * (id + 1) + Game.Objects["Bank"].level - 1;
					const realValue = stockMarket.goodsById[id].val;

					const value = Math.min(1, Math.max(-1, ((realValue - restingValue) / restingValue) * 2)); // positive: sell, negative: buy

					const red1 = 0;
					const green = 120;

					const red2 = 360;
					const blue = 240;

					// buy: green, sell: blue
					let hue = 0;
					if (value > 0) {
						//positive, sell
						hue = red2 - (red2 - blue) * Math.abs(value);
					} else {
						// negative, buy
						hue = red1 + (green - red1) * Math.abs(value);
					}

					let color = "hsl(" + hue + ", 100%, 70%)";

					let smallStyle = "font-weight:bold;color:#fff;";
					let currentValueStyle = "font-weight:bold;color:" + color + ";";

					if (document.getElementById("restingValueText-" + id) !== null) {
						//already exists
						const tooltipText = document.getElementById("restingValueText-" + id);
						tooltipText.innerHTML = "$" + restingValue;

						const currentValue = document.getElementById("bankGood-" + id + "-val");
						currentValue.style = currentValueStyle;
					} else {
						//create box
						const tooltip = document.createElement("div");
						tooltip.style = bigStyle;
						tooltip.id = "restingValueBox-" + id;
						tooltip.className = "bankSymbol";
						tooltip.innerHTML = "安定値: ";

						const tooltipText = document.createElement("span");
						tooltipText.style = smallStyle;
						tooltipText.id = "restingValueText-" + id;
						tooltipText.innerHTML = "$" + restingValue;

						tooltip.appendChild(tooltipText);

						element.firstChild.appendChild(tooltip);
					}
				}
			}
		}
	}

	function update() {
		unbuffedCpsMult = Game.globalCpsMult;

		for (const buff in Game.buffs) {
			let multCpS = Game.buffs[buff].multCpS;
			if (multCpS !== 0 && multCpS !== undefined) {
				unbuffedCpsMult /= multCpS;
			}
		}

		wrinklerBuffedCps = Game.unbuffedCps;
		wrinklerCookies = 0;
		if (options.accountForWrinklers.value) {
			// get boost
			wrinklerThinAirCookieBoost = 1.1;

			if (Game.Has("Sacrilegious corruption")) wrinklerThinAirCookieBoost *= 1.05;
			if (Game.Has("Wrinklerspawn")) wrinklerThinAirCookieBoost *= 1.05;

			wrinklerThinAirCookieBoost *= 1 + Game.auraMult("Dragon Guts") * 0.2;

			if (Game.hasGod) {
				var godLvl = Game.hasGod("scorn");
				if (godLvl == 1) wrinklerThinAirCookieBoost *= 1.15;
				else if (godLvl == 2) wrinklerThinAirCookieBoost *= 1.1;
				else if (godLvl == 3) wrinklerThinAirCookieBoost *= 1.05;
			}

			// get wrinkler number and already made cookies
			wrinklerNumber = 0;
			for (const wrinkler of Game.wrinklers) {
				if (wrinkler.phase === 2) {
					wrinklerNumber++;
					wrinklerCookies += wrinkler.sucked * wrinklerThinAirCookieBoost;
				}
			}

			// get real cps
			wrinklerBuffedCps = (Game.cpsSucked * wrinklerNumber * wrinklerThinAirCookieBoost + (1 - Game.cpsSucked)) * Game.unbuffedCps;
		}

		let upgrades = [];

		// Buildings
		for (let id = 0; id < Game.ObjectsById.length; id++) {
			const building = Game.ObjectsById[id];

			const cps = getBuildingCps(building);
			const price = building.price;
			const name = building.name;

			if (building.locked === 0) {
				upgrades.push({
					value: cps / price,
					cps: cps,
					price: price,
					name: name,
					type: "building",
					id: id,
				});
			} else {
				upgrades.push({
					value: cps / price,
					cps: cps,
					price: price,
					name: "???",
					type: "building",
					id: id,
				});
				break;
			}
		}

		// Upgrades
		if (!options["buildingsOnly"].value)
			for (let i = 0; i < Game.UpgradesInStore.length; i++) {
				const upgrade = Game.UpgradesInStore[i];

				const cps = getUpgradeCps(upgrade);
				const price = upgrade.getPrice();

				if (price !== 0 && cps !== 0) {
					upgrades.push({
						value: cps / price,
						cps: cps,
						price: price,
						name: upgrade.name,
						type: "upgrade",
						id: upgrade.id,
					});
				}
			}

		let sortedUpgrades = [...upgrades];
		sortedUpgrades.sort((a, b) => b.value - a.value);

		let bestUpgrade = sortedUpgrades[0];
		let fasterUpgrade;

		let cookiesPlusWrinklers = Game.cookies + (options.accountForWrinklers.value ? wrinklerCookies : 0);
		if (bestUpgrade.price > cookiesPlusWrinklers && options.checkForFaster.value) {
			let maybeFasterUpgrades = sortedUpgrades.filter((upgrade) => {
				return upgrade.price < bestUpgrade.price;
			});
			let fasterUpgrades = [];

			while (true) {
				fasterUpgrades = [];
				const lackingCookiesForBestUpgrade = (fasterUpgrade ? fasterUpgrade.price : bestUpgrade.price) - cookiesPlusWrinklers;
				const secondsToBestUpgrade = lackingCookiesForBestUpgrade / wrinklerBuffedCps;
				for (const upgrade of maybeFasterUpgrades) {
					const lackingCookies = upgrade.price - cookiesPlusWrinklers;
					const rawSecondsToUpgrade = lackingCookies / wrinklerBuffedCps;

					const secondsToUpgrade = lackingCookies <= 0 ? 0 : Math.max(rawSecondsToUpgrade, 0);
					const secondsToBestUpgradeWithUpgrade =
						(lackingCookiesForBestUpgrade + upgrade.price) / (wrinklerBuffedCps + upgrade.cps);
					const secondsSavedWithUpgrade = secondsToBestUpgrade - (secondsToUpgrade + secondsToBestUpgradeWithUpgrade); // Pure upgrade time - New total upgrade time

					if (secondsSavedWithUpgrade > 0) {
						let betterUpgrade = {};
						for (key in upgrade) {
							betterUpgrade[key] = upgrade[key];
						}
						betterUpgrade.value = secondsSavedWithUpgrade;
						fasterUpgrades.push(betterUpgrade);
					}
				}

				if (fasterUpgrades.length == 0) break;

				fasterUpgrades.sort((a, b) => b.value - a.value);

				fasterUpgrade = fasterUpgrades[0];

				maybeFasterUpgrades = fasterUpgrades.filter((upgrade) => {
					return upgrade.price < fasterUpgrade.price;
				});
			}
		}

		// Display best upgrades
		let info = bestUpgrade;
		if (info) {
			let showTime = getTimeToShow(info.price);
			document.getElementById("best").innerHTML = `<div class="listing"><b>最適 : </b> ${info.type === 'upgrade' ? Game.Upgrades[info.name].dname : loc(info.name)} <small>(CpS : ${Beautify(
				info.cps
			)} , ${showTime})</small></div>`;
		}

		info = fasterUpgrade;
		if (info) {
			let showTime = getTimeToShow(info.price);
			document.getElementById("fast").innerHTML = `<div class="listing"><b>速い : </b> ${info.type === 'upgrade' ? Game.Upgrades[info.name].dname : loc(info.name)} <small>(CpS : ${Beautify(
				info.cps
			)} , ${showTime})</small></div>`;
		} else {
			document.getElementById("fast").innerHTML = "";
		}

		let highlight = fasterUpgrade ? fasterUpgrade : bestUpgrade;

		if (previousHighlight != undefined && previousHighlight.id != undefined) {
			deHighlightPurchase(previousHighlight.type == "building", previousHighlight.id);
		}
		if (options.highlightBestPurchase.value) {
			highlightPurchase(highlight.type == "building", highlight.id);
		}

		previousHighlight = highlight;
	}

	function highlightPurchase(isBuilding, id) {
		if (isBuilding) {
			let storeItem = document.getElementById("product" + id);
			storeItem.style = `box-shadow: 0px 0px 24px #0e0 inset;`;
		} else {
			let storeItem = getStoreUpgradeOfId(id);

			storeItem.classList.add("selected");
		}
	}

	function deHighlightPurchase(isBuilding, id) {
		if (isBuilding) {
			let storeItem = document.getElementById("product" + id);
			storeItem.style = "";
		} else {
			let storeItem = getStoreUpgradeOfId(id);
			if (storeItem != undefined) storeItem.classList.remove("selected");
		}
	}

	function getStoreUpgradeOfId(id) {
		let upgradeElements = [];
		while (true) {
			let element = document.getElementById("upgrade" + upgradeElements.length);
			if (element == null) break;

			upgradeElements.push(element);
		}

		let upgrade = upgradeElements.filter((e) => e.getAttribute("data-id") == id).pop();
		return upgrade;
	}

	function getTimeToShow(price) {
		if (options.accountForWrinklers.value && wrinklerNumber > 0) {
			// get time
			let showTime;
			if (Game.cookies >= price) showTime = "購入可能";
			else if (Game.cookies + wrinklerCookies >= price) showTime = "シワシワ虫を倒す";
			else if (Game.unbuffedCps == 0) showTime = "クッキーをクリック";
			else if (Game.cookies + wrinklerCookies < price) {
				let times = Game.sayTime(((price - (Game.cookies + wrinklerCookies)) / wrinklerBuffedCps) * Game.fps, -1).split(", ");
				showTime = times[0] + (times[1] !== undefined ? " and " + times[1] : "");
			}
			return showTime;
		} else {
			let showTime;
			if (Game.cookies >= price) showTime = "購入可能";
			else if (Game.unbuffedCps == 0) showTime = "クッキーをクリック";
			else if (Game.cookies < price) {
				let times = Game.sayTime(((price - Game.cookies) / Game.unbuffedCps) * Game.fps, -1).split(", ");
				showTime = times[0] + (times[1] !== undefined ? " and " + times[1] : "");
			}
			return showTime;
		}
	}

	function getBuildingCps(building, log = false) {
		let mult = 1;
		mult *= Game.GetTieredCpsMult(Game.ObjectsById[0]);
		mult *= Game.magicCpS("Cursor");
		mult *= Game.eff("cursorCps");

		const cursorBoost = Game.ObjectsById[0].amount * thousandFingersMult() * mult * unbuffedCpsMult;
		let cps;

		//normal cps
		if (building.id === 0) {
			cps = building.storedCps * unbuffedCpsMult;
		} else {
			cps = building.storedCps * unbuffedCpsMult + cursorBoost;
		}

		if (log) console.log(Beautify(building.storedCps * unbuffedCpsMult));

		// synergies
		let synergyBoost = 0;
		if (building.name == "Grandma") {
			for (let i in Game.GrandmaSynergies) {
				if (Game.Has(Game.GrandmaSynergies[i])) {
					const other = Game.Upgrades[Game.GrandmaSynergies[i]].buildingTie;
					let mult = building.amount * 0.01 * (1 / (other.id - 1));
					let boost = other.storedTotalCps * unbuffedCpsMult - (other.storedTotalCps * unbuffedCpsMult) / (1 + mult);

					synergyBoost += boost;
				}
			}

			// One Mind and Communal Brainsweep
			let baseCpSBonus = 0;
			if (Game.Has("One mind")) baseCpSBonus += 0.02;
			if (Game.Has("Communal brainsweep")) baseCpSBonus += 0.02;

			let baseCpS = 1;
			if (Game.Has("One mind")) baseCpS += Game.Objects["Grandma"].amount * 0.02;
			if (Game.Has("Communal brainsweep")) baseCpS += Game.Objects["Grandma"].amount * 0.02;
			if (Game.Has("Elder Pact")) baseCpS += Game.Objects["Portal"].amount * 0.05;

			const mult = (Game.Objects["Grandma"].storedTotalCps * unbuffedCpsMult) / baseCpS;

			cps += baseCpSBonus * mult;
		}

		if (building.name == "Portal" && Game.Has("Elder Pact")) {
			// One Mind and Communal Brainsweep
			let baseCpSBonus = 0.05;

			let baseCpS = 1;
			if (Game.Has("One mind")) baseCpS += Game.Objects["Grandma"].amount * 0.02;
			if (Game.Has("Communal brainsweep")) baseCpS += Game.Objects["Grandma"].amount * 0.02;
			if (Game.Has("Elder Pact")) baseCpS += Game.Objects["Portal"].amount * 0.05;

			const mult = (Game.Objects["Grandma"].storedTotalCps * unbuffedCpsMult) / baseCpS;

			cps += baseCpSBonus * mult;
		}

		for (let i in building.synergies) {
			let it = building.synergies[i];
			if (Game.Has(it.name)) {
				let weight = 0.05;
				let other = it.buildingTie1;
				if (building == it.buildingTie1) {
					weight = 0.001;
					other = it.buildingTie2;
				}
				let boost =
					other.storedTotalCps * unbuffedCpsMult - (other.storedTotalCps * unbuffedCpsMult) / (1 + building.amount * weight);
				synergyBoost += boost;
			}
		}

		if (building.amount !== 0) cps += synergyBoost / building.amount;

		if (Game.hasAura("Elder Battalion") && building.name !== "Grandma") {
			const other = Game.Objects["Grandma"];
			const boostingBuildingCount = Game.BuildingsOwned - other.amount;
			const boost =
				((other.storedTotalCps * unbuffedCpsMult) / (1 + boostingBuildingCount * 0.01)) * (1 + (boostingBuildingCount + 1) * 0.01) -
				other.storedTotalCps * unbuffedCpsMult;
			cps += boost;
			if (log) console.log("Elder Battalion: " + Beautify(boost));
		}

		if (log) {
			console.log("Synergy boosts: " + Beautify(synergyBoost));
		}

		return cps;
	}

	function getUpgradeCps(upgrade) {
		switch (upgrade.name) {
			case "Thousand fingers":
				return thousandFingers(0.1);
			case "Million fingers":
				return thousandFingers(5);
			case "Billion fingers":
				return thousandFingers(10);
			case "Trillion fingers":
			case "Quadrillion fingers":
			case "Quintillion fingers":
			case "Sextillion fingers":
			case "Septillion fingers":
			case "Octillion fingers":
			case "Nonillion fingers":
			case "Decillion fingers":
			case "Undecillion fingers":
				return thousandFingers(20);

			case "Kitten helpers":
			case "Kitten workers":
			case "Kitten engineers":
			case "Kitten overseers":
			case "Kitten managers":
			case "Kitten accountants":
			case "Kitten specialists":
			case "Kitten experts":
			case "Kitten consultants":
			case "Kitten assistants to the regional manager":
			case "Kitten marketeers":
			case "Kitten analysts":
			case "Kitten executives":
			case "Kitten angels":
			case "Fortune #103":
			case "Kitten admins":
			case "Kitten strategists":
				return kittens(upgrade.name);

			case "Plain cookies":
			case "Sugar cookies":
			case "Oatmeal raisin cookies":
			case "Specialized chocolate chips":
			case "One chip cookies":
			case "Wheat slims":
			case "One lone chocolate chip":
			case "Cookie crumbs":
			case "Fortune #100":
			case "A lump of coal":
			case "An itchy sweater":
			case "Chicken egg":
			case "Duck egg":
			case "Turkey egg":
			case "Quail egg":
			case "Robin egg":
			case "Ostrich egg":
			case "Cassowary egg":
			case "Salmon roe":
			case "Frogspawn":
			case "Shark egg":
			case "Turtle egg":
			case "Ant larva":
				return upgradeCookie(1);
			case "Peanut butter cookies":
			case "Coconut cookies":
			case "White chocolate cookies":
			case "Macadamia nut cookies":
			case "Double-chip cookies":
			case "White chocolate macadamia nut cookies":
			case "All-chocolate cookies":
			case "Designer cocoa beans":
			case "Snickerdoodles":
			case "Stroopwafels":
			case "Macaroons":
			case "Empire biscuits":
			case "British tea biscuits":
			case "Chocolate british tea biscuits":
			case "Round british tea biscuits":
			case "Round chocolate british tea biscuits":
			case "Round british tea biscuits with heart motif":
			case "Round chocolate british tea biscuits with heart motif":
			case "Madeleines":
			case "Palmiers":
			case "Palets":
			case "Sabl&eacute;s":
			case "Fig gluttons":
			case "Loreols":
			case "Jaffa cakes":
			case "Grease's cups":
			case "Skull cookies":
			case "Ghost cookies":
			case "Bat cookies":
			case "Slime cookies":
			case "Pumpkin cookies":
			case "Eyeball cookies":
			case "Spider cookies":
			case "Christmas tree biscuits":
			case "Snowflake biscuits":
			case "Snowman biscuits":
			case "Holly biscuits":
			case "Candy cane biscuits":
			case "Bell biscuits":
			case "Present biscuits":
			case "Gingerbread men":
			case "Gingerbread trees":
			case "Eclipse cookies":
			case "Zebra cookies":
			case "Digits":
			case "Festivity loops":
			case "Bakeberry cookies":
			case "Almond cookies":
			case "Hazelnut cookies":
			case "Walnut cookies":
			case "Havabreaks":
			case "Zilla wafers":
			case "Dim Dams":
			case "Pokey":
			case "Cashew cookies":
			case "Milk chocolate cookies":
			case "Nines":
				return upgradeCookie(2);
			case "Underworld ovens":
			case "Caramoas":
			case "Sagalongs":
			case "Shortfoils":
			case "Win mints":
			case "Rose macarons":
			case "Lemon macarons":
			case "Chocolate macarons":
			case "Pistachio macarons":
			case "Hazelnut macarons":
			case "Violet macarons":
			case "Caramel macarons":
			case "Licorice macarons":
			case "Ladyfingers":
			case "Tuiles":
			case "Chocolate-stuffed biscuits":
			case "Checker cookies":
			case "Butter cookies":
			case "Cream cookies":
			case "Lombardia cookies":
			case "Bastenaken cookies":
			case "A chocolate chip cookie but with the chips picked off for some reason":
			case "Dragon scale":
			case "Earl Grey macarons":
				return upgradeCookie(3);
			case "Exotic nuts":
			case "Gingersnaps":
			case "Cinnamon cookies":
			case "Vanity cookies":
			case "Cigars":
			case "Pinwheel cookies":
			case "Fudge squares":
			case "Butter horseshoes":
			case "Butter pucks":
			case "Butter knots":
			case "Butter slabs":
			case "Butter swirls":
			case "Shortbread biscuits":
			case "Millionaires' shortbreads":
			case "Caramel cookies":
			case "Pecan sandies":
			case "Moravian spice cookies":
			case "Anzac biscuits":
			case "Buttercakes":
			case "Ice cream sandwiches":
			case "Pink biscuits":
			case "Whole-grain cookies":
			case "Candy cookies":
			case "Big chip cookies":
			case "Sprinkles cookies":
			case "Peanut butter blossoms":
			case "No-bake cookies":
			case "Florentines":
			case "Chocolate crinkles":
			case "Maple cookies":
			case "Persian rice cookies":
			case "Norwegian cookies":
			case "Crispy rice cookies":
			case "Ube cookies":
			case "Butterscotch cookies":
			case "Speculaas":
			case "Chocolate oatmeal cookies":
			case "Molasses cookies":
			case "Biscotti":
			case "Waffle cookies":
			case "Custard creams":
			case "Bourbon biscuits":
			case "Profiteroles":
			case "Jelly donut":
			case "Glazed donut":
			case "Chocolate cake":
			case "Strawberry cake":
			case "Apple pie":
			case "Lemon meringue pie":
			case "Butter croissant":
			case "Cookie dough":
			case "Burnt cookie":
			case "Flavor text cookie":
			case "Toast":
			case "Peanut butter & jelly":
			case "Wookies":
			case "Cheeseburger":
			case "Crackers":
			case "Baklavas":
				return upgradeCookie(4);
			case "Dark chocolate-coated cookies":
			case "White chocolate-coated cookies":
			case "Arcane sugar":
			case "Pure black chocolate cookies":
			case "Pure white chocolate cookies":
			case "Dragon cookie":
			case "Mini-cookies":
			case "High-definition cookie":
			case "Whoopie pies":
			case "Caramel wafer biscuits":
			case "Chocolate chip mocha cookies":
			case "Earl Grey cookies":
			case "Corn syrup cookies":
			case "Icebox cookies":
			case "Graham crackers":
			case "Hardtack":
			case "Cornflake cookies":
			case "Tofu cookies":
			case "Gluten-free cookies":
			case "Russian bread cookies":
			case "Lebkuchen":
			case "Aachener Printen":
			case "Canistrelli":
			case "Nice biscuits":
			case "French pure butter cookies":
			case "Petit beurre":
			case "Nanaimo bars":
			case "Berger cookies":
			case "Panda koala biscuits":
			case "Putri salju":
			case "Milk cookies":
			case "Kruidnoten":
			case "Marie biscuits":
			case "Meringue cookies":
			case "Pizza":
			case "Chai tea cookies":
			case "Yogurt cookies":
			case "Thumbprint cookies":
			case "Pizzelle":
			case "Candy":
			case "Granola cookies":
			case "Ricotta cookies":
			case "Roze koeken":
			case "Peanut butter cup cookies":
			case "Sesame cookies":
			case "Taiyaki":
			case "Vanillekipferl":
			case "Battenberg biscuits":
			case "Rosette cookies":
			case "Gangmakers":
			case "Welsh cookies":
			case "Raspberry cheesecake cookies":
			case "Bokkenpootjes":
			case "Fat rascals":
			case "Ischler cookies":
			case "Matcha cookies":
			case "Deep-fried cookie dough":
			case "Dalgona cookies":
			case "Spicy cookies":
			case "Smile cookies":
			case "Kolachy cookies":
			case "Gomma cookies":
			case "Vegan cookies":
			case "Coyotas":
			case "Frosted sugar cookies":
			case "Marshmallow sandwich cookies":
			case "Web cookies":
			case "Chinsuko":
			case "Snowball cookies":
			case "Sequilhos":
			case "Hazelnut swirlies":
			case "Spritz cookies":
			case "Mbatata cookies":
			case "Springerles":
			case "Havreflarn":
			case "Alfajores":
			case "Gaufrettes":
			case "Cookie bars":
				return upgradeCookie(5);
			case "Fortune #101":
				return upgradeCookie(7);
			case "Milk chocolate butter biscuit":
			case "Dark chocolate butter biscuit":
			case "White chocolate butter biscuit":
			case "Ruby chocolate butter biscuit":
			case "Lavender chocolate butter biscuit":
			case "Duketater cookies":
			case "Synthetic chocolate green honey butter biscuit":
			case "Royal raspberry chocolate butter biscuit":
			case "Ultra-concentrated high-energy chocolate butter biscuit":
			case "Pure pitch-black chocolate butter biscuit":
			case "Chocolate chip cookie":
			case "Cosmic chocolate butter biscuit":
			case "Butter biscuit (with butter)":
			case "Everybutter biscuit":
			case "Personal biscuit":
				return upgradeCookie(10);
			case "Increased merriness":
			case "Improved jolliness":
				return upgradeCookie(15);
			case "Santa's dominion":
				return upgradeCookie(20);
			case "Birthday cookie":
				return upgradeCookie(Math.floor((Date.now() - new Date(2013, 7, 8)) / (1000 * 60 * 60 * 24 * 365)));
			case "Sugar baking":
				return upgradeCookie(Math.min(Game.lumps, 100));
			case "Pure heart biscuits":
			case "Ardent heart biscuits":
			case "Sour heart biscuits":
			case "Weeping heart biscuits":
			case "Golden heart biscuits":
			case "Eternal heart biscuits":
			case "Prism heart biscuits":
				return upgradeCookie(heartPower());
			case "Santa's legacy":
				return upgradeCookie((Game.santaLevel + 1) * 3);
			case "Bingo center/Research facility":
				return Game.ObjectsById[1].storedTotalCps * unbuffedCpsMult * 3;

			case "Reinforced index finger":
			case "Carpal tunnel prevention cream":
			case "Ambidextrous":
				return doubleCps(0, upgrade.name);
			case "Forwards from grandma":
			case "Steel-plated rolling pins":
			case "Lubricated dentures":
			case "Prune juice":
			case "Ritual rolling pins":
			case "Double-thick glasses":
			case "Aging agents":
			case "Xtreme walkers":
			case "The Unbridling":
			case "Reverse dementia":
			case "Timeproof hair dyes":
			case "Good manners":
			case "Generation degeneration":
			case "Visits":
			case "Naughty list":
			case "Kitchen cabinets":
			case "Foam-tipped canes":
				return doubleCps(1, upgrade.name);
			case "Cheap hoes":
			case "Fertilizer":
			case "Cookie trees":
			case "Genetically-modified cookies":
			case "Gingerbread scarecrows":
			case "Pulsar sprinklers":
			case "Fudge fungus":
			case "Wheat triffids":
			case "Humane pesticides":
			case "Barnstars":
			case "Lindworms":
			case "Global seed vault":
			case "Reverse-veganism":
			case "Cookie mulch":
			case "Self-driving tractors":
				return doubleCps(2, upgrade.name);
			case "Sugar gas":
			case "Megadrill":
			case "Ultradrill":
			case "Ultimadrill":
			case "H-bomb mining":
			case "Coreforge":
			case "Planetsplitters":
			case "Canola oil wells":
			case "Mole people":
			case "Mine canaries":
			case "Bore again":
			case "Air mining":
			case "Caramel alloys":
			case "Delicious mineralogy":
			case "Mineshaft supports":
				return doubleCps(3, upgrade.name);
			case "Sturdier conveyor belts":
			case "Child labor":
			case "Sweatshop":
			case "Radium reactors":
			case "Recombobulators":
			case "Deep-bake process":
			case "Cyborg workforce":
			case "78-hour days":
			case "Machine learning":
			case "Brownie point system":
			case '"Volunteer" interns':
			case "Behavioral reframing":
			case "The infinity engine":
			case "N-dimensional assembly lines":
			case "Universal automation":
				return doubleCps(4, upgrade.name);
			case "Taller tellers":
			case "Scissor-resistant credit cards":
			case "Acid-proof vaults":
			case "Chocolate coins":
			case "Exponential interest rates":
			case "Financial zen":
			case "Way of the wallet":
			case "The stuff rationale":
			case "Edible money":
			case "Grand supercycles":
			case "Rules of acquisition":
			case "Altruistic loop":
			case "Diminishing tax returns":
			case "Cookie Points":
			case "The big shortcake":
				return doubleCps(5, upgrade.name);
			case "Golden idols":
			case "Sacrifices":
			case "Delicious blessing":
			case "Sun festival":
			case "Enlarged pantheon":
			case "Great Baker in the sky":
			case "Creation myth":
			case "Theocracy":
			case "Sick rap prayers":
			case "Psalm-reading":
			case "War of the gods":
			case "A novel idea":
			case "Apparitions":
			case "Negatheism":
			case "Temple traps":
				return doubleCps(6, upgrade.name);
			case "Pointier hats":
			case "Beardlier beards":
			case "Ancient grimoires":
			case "Kitchen curses":
			case "School of sorcery":
			case "Dark formulas":
			case "Cookiemancy":
			case "Rabbit trick":
			case "Deluxe tailored wands":
			case "Immobile spellcasting":
			case "Electricity":
			case "Spelling bees":
			case "Wizard basements":
			case "Magical realism":
			case "Polymorphism":
				return doubleCps(7, upgrade.name);
			case "Vanilla nebulae":
			case "Wormholes":
			case "Frequent flyer":
			case "Warp drive":
			case "Chocolate monoliths":
			case "Generation ship":
			case "Dyson sphere":
			case "The final frontier":
			case "Autopilot":
			case "Restaurants at the end of the universe":
			case "Universal alphabet":
			case "Toroid universe":
			case "Prime directive":
			case "Cosmic foreground radiation":
			case "At your doorstep in 30 minutes or your money back":
				return doubleCps(8, upgrade.name);
			case "Antimony":
			case "Essence of dough":
			case "True chocolate":
			case "Ambrosia":
			case "Aqua crustulae":
			case "Origin crucible":
			case "Theory of atomic fluidity":
			case "Beige goo":
			case "The advent of chemistry":
			case "On second thought":
			case "Public betterment":
			case "Hermetic reconciliation":
			case "Chromatic cycling":
			case "Arcanized glassware":
			case "The dose makes the poison":
				return doubleCps(9, upgrade.name);
			case "Ancient tablet":
			case "Insane oatling workers":
			case "Soul bond":
			case "Sanity dance":
			case "Brane transplant":
			case "Deity-sized portals":
			case "End of times back-up plan":
			case "Maddening chants":
			case "The real world":
			case "Dimensional garbage gulper":
			case "Embedded microportals":
			case "His advent":
			case "Domestic rifts":
			case "Portal guns":
			case "A way home":
				return doubleCps(10, upgrade.name);
			case "Flux capacitors":
			case "Time paradox resolver":
			case "Quantum conundrum":
			case "Causality enforcer":
			case "Yestermorrow comparators":
			case "Far future enactment":
			case "Great loop hypothesis":
			case "Cookietopian moments of maybe":
			case "Second seconds":
			case "Additional clock hands":
			case "Nostalgia":
			case "Split seconds":
			case "Patience abolished":
			case "Timeproof upholstery":
			case "Rectifying a mistake":
				return doubleCps(11, upgrade.name);
			case "Sugar bosons":
			case "String theory":
			case "Large macaron collider":
			case "Big bang bake":
			case "Reverse cyclotrons":
			case "Nanocosmics":
			case "The Pulse":
			case "Some other super-tiny fundamental particle? Probably?":
			case "Quantum comb":
			case "Baking Nobel prize":
			case "The definite molecule":
			case "Flavor itself":
			case "Delicious pull":
			case "Employee minification":
			case "Candied atoms":
				return doubleCps(12, upgrade.name);
			case "Gem polish":
			case "9th color":
			case "Chocolate light":
			case "Grainbow":
			case "Pure cosmic light":
			case "Glow-in-the-dark":
			case "Lux sanctorum":
			case "Reverse shadows":
			case "Crystal mirrors":
			case "Reverse theory of light":
			case "Light capture measures":
			case "Light speed limit":
			case "Occam's laser":
			case "Hyperblack paint":
			case "Lab goggles but like cool shades":
				return doubleCps(13, upgrade.name);
			case "Your lucky cookie":
			case '"All Bets Are Off" magic coin':
			case "Winning lottery ticket":
			case "Four-leaf clover field":
			case "A recipe book about books":
			case "Leprechaun village":
			case "Improbability drive":
			case "Antisuperstistronics":
			case "Bunnypedes":
			case "Revised probabilistics":
			case "0-sided dice":
			case "A touch of determinism":
			case "On a streak":
			case "Silver lining maximization":
			case "Gambler's fallacy fallacy":
				return doubleCps(14, upgrade.name);
			case "Metabakeries":
			case "Mandelbrown sugar":
			case "Fractoids":
			case "Nested universe theory":
			case "Menger sponge cake":
			case "One particularly good-humored cow":
			case "Chocolate ouroboros":
			case "Nested":
			case "Space-filling fibers":
			case "Endless book of prose":
			case "The set of all sets":
			case "This upgrade":
			case "A box":
			case "Multiscale profiling":
			case "The more they stay the same":
				return doubleCps(15, upgrade.name);
			case "The JavaScript console for dummies":
			case "64bit arrays":
			case "Stack overflow":
			case "Enterprise compiler":
			case "Syntactic sugar":
			case "A nice cup of coffee":
			case "Just-in-time baking":
			case "cookies++":
			case "Software updates":
			case "Game.Loop":
			case "eval()":
			case "Your biggest fans":
			case "Hacker shades":
			case "PHP containment vats":
			case "Simulation failsafes":
				return doubleCps(16, upgrade.name);
			case "Manifest destiny":
			case "The multiverse in a nutshell":
			case "All-conversion":
			case "Multiverse agents":
			case "Escape plan":
			case "Game design":
			case "Sandbox universes":
			case "Multiverse wars":
			case "Mobile ports":
			case "Encapsulated realities":
			case "Extrinsic clicking":
			case "Universal idling":
			case "Break the fifth wall":
			case "Opposite universe":
			case "The other routes to Rome":
				return doubleCps(17, upgrade.name);
			case "Principled neural shackles":
			case "Obey":
			case "A sprinkle of irrationality":
			case "Front and back hemispheres":
			case "Neural networking":
			case "Cosmic brainstorms":
			case "Megatherapy":
			case "Synaptic lubricant":
			case "Psychokinesis":
			case "Spines":
			case "Neuraforming":
			case "Epistemological trickery":
			case "Every possible idea":
			case "The land of dreams":
			case "Intellectual property theft":
				return doubleCps(18, upgrade.name);
			case "Cloning vats":
			case "Energized nutrients":
			case "Stunt doubles":
			case "Clone recycling plant":
			case "Free-range clones":
			case "Genetic tailoring":
			case "Power in diversity":
			case "Self-betterment":
			case "Source control":
			case "United workforce":
			case "Safety patrols":
			case "One big family":
			case "Clone rights":
			case "Fine-tuned body plans":
			case "Reading your clones bedtime stories":
				return doubleCps(19, upgrade.name);

			case "Fortune #001":
			case "Fortune #002":
			case "Fortune #003":
			case "Fortune #004":
			case "Fortune #005":
			case "Fortune #006":
			case "Fortune #007":
			case "Fortune #008":
			case "Fortune #009":
			case "Fortune #010":
			case "Fortune #011":
			case "Fortune #012":
			case "Fortune #013":
			case "Fortune #014":
			case "Fortune #015":
			case "Fortune #016":
			case "Fortune #017":
			case "Fortune #018":
			case "Fortune #019":
			case "Fortune #020":
				return fortune(Number(upgrade.name.substr(upgrade.name.length - 3)) - 1);

			case "Farmer grandmas":
			case "Miner grandmas":
			case "Worker grandmas":
			case "Cosmic grandmas":
			case "Transmuted grandmas":
			case "Altered grandmas":
			case "Grandmas' grandmas":
			case "Antigrandmas":
			case "Rainbow grandmas":
			case "Banker grandmas":
			case "Priestess grandmas":
			case "Witch grandmas":
			case "Lucky grandmas":
			case "Metagrandmas":
			case "Binary grandmas":
			case "Alternate grandmas":
			case "Brainy grandmas":
			case "Clone grandmas":
				return grandmaSynergy(Game.GrandmaSynergies.indexOf(upgrade.name) + 2);

			case "Heavenly chip secret":
			case "Heavenly cookie stand":
			case "Heavenly bakery":
			case "Heavenly confectionery":
			case "Heavenly key":
				return prestige();

			case "Future almanacs":
			case "Rain prayer":
			case "Seismic magic":
			case "Asteroid mining":
			case "Quantum electronics":
			case "Temporal overclocking":
			case "Contracts from beyond":
			case "Printing presses":
			case "Paganism":
			case "God particle":
			case "Arcane knowledge":
			case "Magical botany":
			case "Fossil fuels":
			case "Shipyards":
			case "Primordial ores":
			case "Gold fund":
			case "Infernal crops":
			case "Abysmal glimmer":
			case "Relativistic parsec-skipping":
			case "Primeval glow":
			case "Extra physics funding":
			case "Chemical proficiency":
			case "Light magic":
			case "Mystical energies":
			case "Gemmed talismans":
			case "Recursive mirrors":
			case "Script grannies":
			case "Fertile minds":
			case "Thoughts & prayers":
			case "Mice clicking mice":
			case "Charm quarks":
			case "Tombola computing":
			case "Perforated mille-feuille cosmos":
			case "Infraverses and superverses":
			case "Peer review":
			case "Accelerated development":
				return doubleSynergies(upgrade);

			case "Santa's milk and cookies":
				return SantaMilkAndCookies();

			case '"egg"':
				return 9 * unbuffedCpsMult;

			case "Century egg":
				return centuryEgg();
			case "Elderwort biscuits":
				return upgradeCookie(2) + Game.Objects["Grandma"].storedTotalCps * unbuffedCpsMult * 0.02;

			default:
				return 0;
		}
	}

	function doubleSynergies(upgrade) {
		let building1 = upgrade.buildingTie1;
		let building2 = upgrade.buildingTie2;

		let boost1Earnings = building1.storedTotalCps * unbuffedCpsMult * (0.05 * building2.amount);
		let boost2Earnings = building2.storedTotalCps * unbuffedCpsMult * (0.001 * building1.amount);

		return boost1Earnings + boost2Earnings;
	}

	function centuryEgg() {
		let day = (Math.floor((Date.now() - Game.startDate) / 1000 / 10) * 10) / 60 / 60 / 24;
		day = Math.min(day, 100);
		let eggMult = 1 + (1 - Math.pow(1 - day / 100, 3)) * 0.1;
		return eggMult * Game.unbuffedCps - Game.unbuffedCps;
	}

	function prestige() {
		let oldHeavenlyMult = Game.GetHeavenlyMultiplier();
		let newHeavenlyMult = 0;
		newHeavenlyMult += 0.05;
		if (Game.Has("Heavenly chip secret")) newHeavenlyMult += 0.2;
		if (Game.Has("Heavenly cookie stand")) newHeavenlyMult += 0.25;
		if (Game.Has("Heavenly bakery")) newHeavenlyMult += 0.25;
		if (Game.Has("Heavenly confectionery")) newHeavenlyMult += 0.25;

		newHeavenlyMult *= 1 + Game.auraMult("Dragon God") * 0.05;
		if (Game.Has("Lucky digit")) newHeavenlyMult *= 1.01;
		if (Game.Has("Lucky number")) newHeavenlyMult *= 1.01;
		if (Game.Has("Lucky payout")) newHeavenlyMult *= 1.01;
		if (Game.hasGod) {
			let godLvl = Game.hasGod("creation");
			if (godLvl == 1) newHeavenlyMult *= 0.7;
			else if (godLvl == 2) newHeavenlyMult *= 0.8;
			else if (godLvl == 3) newHeavenlyMult *= 0.9;
		}

		let newMult =
			(unbuffedCpsMult / (oldHeavenlyMult * parseFloat(Game.prestige) * 0.01 * Game.heavenlyPower + 1)) *
			(newHeavenlyMult * parseFloat(Game.prestige) * 0.01 * Game.heavenlyPower + 1);

		let oldCps = Game.unbuffedCps;
		let newCps = (Game.unbuffedCps / unbuffedCpsMult) * newMult;

		return newCps - oldCps;
	}

	function grandmaSynergy(objectID) {
		const grandmaCpS = Game.ObjectsById[1].storedTotalCps * unbuffedCpsMult;

		const boost = Game.Objects["Grandma"].amount * 0.01 * (1 / (objectID - 1));
		const otherCpS = Game.ObjectsById[objectID].storedTotalCps * unbuffedCpsMult * boost;

		return grandmaCpS + otherCpS;
	}

	function doubleCps(objectID, upgradeName) {
		let building = Game.ObjectsById[objectID];
		let upgrade = Game.Upgrades[upgradeName];

		if (
			objectID === 0 ||
			upgradeName === "Ritual rolling pins" ||
			upgradeName === "Naughty list" ||
			building.unshackleUpgrade === undefined
		)
			return Game.ObjectsById[objectID].storedTotalCps * unbuffedCpsMult;

		let tierMult = 1;
		if (
			Game.ascensionMode !== 1 &&
			Game.Has(building.unshackleUpgrade) === 1 &&
			Game.Has(Game.Tiers[upgrade.tier].unshackleUpgrade) === 1
		)
			tierMult += building.id == 1 ? 0.5 : (20 - building.id) * 0.1;
		return Game.ObjectsById[objectID].storedTotalCps * unbuffedCpsMult * tierMult;
	}

	function fortune(objectID) {
		return Game.ObjectsById[objectID].storedTotalCps * unbuffedCpsMult * 0.07;
	}

	function thousandFingers(multiplier) {
		let num = Game.BuildingsOwned - Game.ObjectsById[0].amount;
		let afterAdd = multiplier === 0.1 ? thousandFingersMult(true) * num : thousandFingersMult() * multiplier * num;

		let mult = 1;
		mult *= Game.GetTieredCpsMult(Game.ObjectsById[0]);
		mult *= Game.magicCpS("Cursor");
		mult *= Game.eff("cursorCps");

		let before = Game.ObjectsById[0].storedCps * unbuffedCpsMult;
		let after =
			Game.ComputeCps(
				0.1,
				Game.Has("Reinforced index finger") + Game.Has("Carpal tunnel prevention cream") + Game.Has("Ambidextrous"),
				afterAdd
			) *
			mult *
			unbuffedCpsMult;

		let value = (after - before) * Game.ObjectsById[0].amount;
		return value;
	}

	function thousandFingersMult(isBuyingThousand) {
		let add = 0;

		if (Game.Has("Thousand fingers") || isBuyingThousand) add += 0.1;
		if (Game.Has("Million fingers")) add *= 5;
		if (Game.Has("Billion fingers")) add *= 10;
		if (Game.Has("Trillion fingers")) add *= 20;
		if (Game.Has("Quadrillion fingers")) add *= 20;
		if (Game.Has("Quintillion fingers")) add *= 20;
		if (Game.Has("Sextillion fingers")) add *= 20;
		if (Game.Has("Septillion fingers")) add *= 20;
		if (Game.Has("Octillion fingers")) add *= 20;
		if (Game.Has("Nonillion fingers")) add *= 20;
		if (Game.Has("Decillion fingers")) add *= 20;
		if (Game.Has("Undecillion fingers")) add *= 20;
		if (Game.Has("Unshackled cursors") && Game.ascensionMode !== 1) add *= 25;

		return add;
	}

	function upgradeCookie(power) {
		return Game.unbuffedCps * (power * 0.01);
	}

	function heartPower() {
		let pow = 2;
		if (Game.Has("Starlove")) pow = 3;
		if (Game.hasGod) {
			let godLvl = Game.hasGod("seasons");
			if (godLvl == 1) pow *= 1.3;
			else if (godLvl == 2) pow *= 1.2;
			else if (godLvl == 3) pow *= 1.1;
		}
		return pow;
	}

	function SantaMilkAndCookies() {
		let milkMult = 1.05;
		milkMult *= 1 + Game.auraMult("Breath of Milk") * 0.05;
		if (Game.hasGod) {
			let godLvl = Game.hasGod("mother");
			if (godLvl == 1) milkMult *= 1.1;
			else if (godLvl == 2) milkMult *= 1.05;
			else if (godLvl == 3) milkMult *= 1.03;
		}

		let newCatMult = 1;

		if (Game.Has("Kitten helpers")) newCatMult *= 1 + Game.milkProgress * 0.1 * milkMult;
		if (Game.Has("Kitten workers")) newCatMult *= 1 + Game.milkProgress * 0.125 * milkMult;
		if (Game.Has("Kitten engineers")) newCatMult *= 1 + Game.milkProgress * 0.15 * milkMult;
		if (Game.Has("Kitten overseers")) newCatMult *= 1 + Game.milkProgress * 0.175 * milkMult;
		if (Game.Has("Kitten managers")) newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		if (Game.Has("Kitten accountants")) newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		if (Game.Has("Kitten specialists")) newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		if (Game.Has("Kitten experts")) newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		if (Game.Has("Kitten consultants")) newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		if (Game.Has("Kitten assistants to the regional manager")) newCatMult *= 1 + Game.milkProgress * 0.175 * milkMult;
		if (Game.Has("Kitten marketeers")) newCatMult *= 1 + Game.milkProgress * 0.15 * milkMult;
		if (Game.Has("Kitten analysts")) newCatMult *= 1 + Game.milkProgress * 0.125 * milkMult;
		if (Game.Has("Kitten executives")) newCatMult *= 1 + Game.milkProgress * 0.115 * milkMult;
		if (Game.Has("Kitten admins")) newCatMult *= 1 + Game.milkProgress * 0.11 * milkMult;
		if (Game.Has("Kitten angels")) newCatMult *= 1 + Game.milkProgress * 0.1 * milkMult;
		if (Game.Has("Fortune #103")) newCatMult *= 1 + Game.milkProgress * 0.05 * milkMult;

		return (Game.unbuffedCps / Game.cookiesMultByType["kittens"]) * newCatMult - Game.unbuffedCps;
	}

	function kittens(name) {
		let milkMult = 1;
		if (Game.Has("Santa's milk and cookies")) milkMult *= 1.05;
		milkMult *= 1 + Game.auraMult("Breath of Milk") * 0.05;
		if (Game.hasGod) {
			let godLvl = Game.hasGod("mother");
			if (godLvl == 1) milkMult *= 1.1;
			else if (godLvl == 2) milkMult *= 1.05;
			else if (godLvl == 3) milkMult *= 1.03;
		}
		milkMult *= Game.eff("milk");

		let newCatMult = Game.cookiesMultByType["kittens"];
		if (name == "Kitten helpers") newCatMult *= 1 + Game.milkProgress * 0.1 * milkMult;
		else if (name == "Kitten workers") newCatMult *= 1 + Game.milkProgress * 0.125 * milkMult;
		else if (name == "Kitten engineers") newCatMult *= 1 + Game.milkProgress * 0.15 * milkMult;
		else if (name == "Kitten overseers") newCatMult *= 1 + Game.milkProgress * 0.175 * milkMult;
		else if (name == "Kitten managers") newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		else if (name == "Kitten accountants") newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		else if (name == "Kitten specialists") newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		else if (name == "Kitten experts") newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		else if (name == "Kitten consultants") newCatMult *= 1 + Game.milkProgress * 0.2 * milkMult;
		else if (name == "Kitten assistants to the regional manager") newCatMult *= 1 + Game.milkProgress * 0.175 * milkMult;
		else if (name == "Kitten marketeers") newCatMult *= 1 + Game.milkProgress * 0.15 * milkMult;
		else if (name == "Kitten analysts") newCatMult *= 1 + Game.milkProgress * 0.125 * milkMult;
		else if (name == "Kitten executives") newCatMult *= 1 + Game.milkProgress * 0.115 * milkMult;
		else if (name == "Kitten admins") newCatMult *= 1 + Game.milkProgress * 0.11 * milkMult;
		else if (name == "Kitten strategists") newCatMult *= 1 + Game.milkProgress * 0.105 * milkMult;
		else if (name == "Kitten angels") newCatMult *= 1 + Game.milkProgress * 0.1 * milkMult;
		else if (name == "Fortune #103") newCatMult *= 1 + Game.milkProgress * 0.05 * milkMult;

		return (Game.unbuffedCps / Game.cookiesMultByType["kittens"]) * newCatMult - Game.unbuffedCps;
	}
}
