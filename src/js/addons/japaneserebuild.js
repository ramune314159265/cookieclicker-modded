async function rebuildLocalization() {
	const funcInitString = Game.Init.toString().replaceAll(/[\r\n\t]/g, '')
	const GetTooltipFunc = (text, position) => {
		let str = position ? Game.getTooltip(text, position) : Game.getTooltip(text)
		const mouseOverText = 'onMouseOver="'
		return Function('event', str.substring(str.indexOf(mouseOverText) + mouseOverText.length, str.length - '"'.length))
	}

	// ベーカリー名欄
	Game.bakeryNameL.textContent = loc('%1\'s bakery', Game.bakeryName)


	// 昇天画面上部メニュー
	l('ascendButton').onmouseover = GetTooltipFunc(`<div style="min-width:300px;text-align:center;font-size:11px;padding:8px;" id="tooltipReincarnate">${loc('Click this once you\'ve bought<br>everything you need!')}</div>`, 'bottom-right')
	l('ascendButton').children[0].innerHTML = loc('Reincarnate')
	l('ascendInfo').getElementsByClassName('ascendData')[0].innerHTML = loc('You are ascending.<br>Drag the screen around<br>or use arrow keys!<br>When you\'re ready,<br>click Reincarnate.')
	Game.UpdateAscensionModePrompt()

	// 設定画面オンオフ
	ON = ' ' + loc('ON')
	OFF = ' ' + loc('OFF')

	// 施設非表示欄
	for (let pm of document.getElementsByClassName('productMute')) {
		pm.onmouseover = GetTooltipFunc(`<div style="width:150px;text-align:center;font-size:11px;" id="tooltipMuteBuilding"><b>${loc('Mute')}</b><br>(${loc('Minimize this building')})</div>`, 'this')
		pm.innerHTML = loc('Mute')
	}
	l('buildingsMute').children[0].innerHTML = loc('Muted:')

	// ミニゲーム名
	Game.Objects['Farm'].minigameName = loc('Garden')
	Game.Objects['Factory'].minigameName = loc('Dungeon')
	Game.Objects['Bank'].minigameName = loc('Stock Market')
	Game.Objects['Temple'].minigameName = loc('Pantheon')
	Game.Objects['Wizard tower'].minigameName = loc('Grimoire')

	// 施設名、概要、ビジネスシーズン時の施設名、概要
	for (let i in Game.Objects) {
		Game.Objects[i].dname = loc(Game.Objects[i].name)
		Game.Objects[i].single = Game.Objects[i].dname
		Game.Objects[i].plural = Game.Objects[i].dname
		Game.Objects[i].desc = loc(FindLocStringByPart(Game.Objects[i].name + ' quote'))
		Game.foolObjects[i].name = loc(FindLocStringByPart(Game.Objects[i].name + ' business name')) || Game.foolObjects[i].name
		Game.foolObjects[i].desc = loc(FindLocStringByPart(Game.Objects[i].name + ' business quote')) || Game.foolObjects[i].desc
	}
	Game.foolObjects['Unknown'].name = loc('Investment')
	Game.foolObjects['Unknown'].desc = loc('You\'re not sure what this does, you just know it means profit.')

	// アップグレード名、実績名
	LocalizeUpgradesAndAchievs()

	// バフ名
	for (let bf in Game.buffs) {
		Game.buffs[bf].dname = loc(Game.buffs[bf].name)
	}

	// ミルク名
	for (let ml in Game.AllMilks) {
		Game.AllMilks[ml].name = loc(Game.AllMilks[ml].bname)
	}

	// 中央メニュー欄各種ボタン
	l('prefsButton').firstChild.innerHTML = loc('Options')
	l('statsButton').firstChild.innerHTML = loc('Stats')
	l('logButton').firstChild.innerHTML = loc('Info')
	l('legacyButton').firstChild.innerHTML = loc('Legacy')

	if (!betterJapanese.origins.adaptWidth) betterJapanese.origins.adaptWidth = Game.adaptWidth
	Game.adaptWidth = function (node) {
		let el = node.firstElementChild
		el.style.padding = ''
		let width = el.clientWidth / 95
		if (width > 1) {
			el.style.fontSize = (parseInt(window.getComputedStyle(el).fontSize) * 1 / width) + 'px'
			el.style.transform = `scale(1,${width})`
		}
	}

	Game.adaptWidth(l('prefsButton'))

	Game.adaptWidth(l('legacyButton'))

	// 更新時「情報」ボタン上通知
	l('checkForUpdate').childNodes[0].textContent = loc('New update!')

	// 右メニュー欄
	l('buildingsTitle').childNodes[0].textContent = loc('Buildings')
	l('storeTitle').childNodes[0].textContent = loc('Store')

	// アップグレード、実績用の汎用概要文取得関数
	let strCookieProductionMultiplierPlus = loc('Cookie production multiplier <b>+%1%</b>.', '[x]')

	let getStrCookieProductionMultiplierPlus = function (x) {
		return strCookieProductionMultiplierPlus.replace('[x]', x)
	}

	let getStrThousandFingersGain = function (x) {
		return loc('Multiplies the gain from %1 by <b>%2</b>.', [getUpgradeName('Thousand fingers'), x])
	}

	let strKittenDesc = loc('You gain <b>more CpS</b> the more milk you have.')

	let getStrClickingGains = function (x) {
		return loc('Clicking gains <b>+%1% of your CpS</b>.', x)
	}

	// シナジー系アップグレード概要
	for (let result of funcInitString.matchAll(/(?<!\/\/)Game\.SynergyUpgrade\('(.+?)(?<!\\)',/g)) {
		let name = result[1].replaceAll('\\\'', '\'')
		let obj = Game.Upgrades[name]
		obj.baseDesc = loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(obj.buildingTie1.plural), 5, obj.buildingTie2.single]) + '<br>' + loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(obj.buildingTie2.plural), 0.1, obj.buildingTie1.single])
	}

	// ティア別抑制解除系アップグレード概要
	for (let result of funcInitString.matchAll(/(?<!\/\/)Game\.NewUnshackleUpgradeTier\({tier:(\d+?),/g)) {
		let tier = Number(result[1])
		let obj
		if (tier == 1) {
			obj = Game.Upgrades['Unshackled flavor']
		} else {
			obj = Game.Upgrades['Unshackled ' + Game.Tiers[tier].name.toLowerCase()]
		}
		tier = Game.Tiers[tier]
		obj.baseDesc = loc('Unshackles all <b>%1-tier upgrades</b>, making them more powerful.<br>Only applies to unshackled buildings.', cap(loc('[Tier]' + tier.name, 0, tier.name)))
	}

	// グランマシナジー系アップグレード概要
	for (let result of funcInitString.matchAll(/(?<!\/\/)Game\.GrandmaSynergy\('(.+?)(?<!\\)',/g)) {
		let obj = Game.Upgrades[result[1].replaceAll('\\\'', '\'')]
		obj.baseDesc = loc('%1 are <b>twice</b> as efficient.', cap(Game.Objects['Grandma'].plural)) + ' ' + loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(obj.buildingTie.plural), 1, loc('%1 grandma', LBeautify(obj.buildingTie.id - 1))])
	}

	// Game.lastで翻訳されているアップグレードの再翻訳
	Game.Upgrades['Birthday cookie'].baseDesc = loc('Cookie production multiplier <b>+%1%</b> for every year Cookie Clicker has existed (currently: <b>+%2%</b>).', [1, Beautify(Math.floor((Date.now() - new Date(2013, 7, 8)) / (1000 * 60 * 60 * 24 * 365)))])
	Game.Upgrades['Elderwort biscuits'].baseDesc = `${getStrCookieProductionMultiplierPlus(2)}<br>${loc('%1 are <b>%2%</b> more powerful.', [cap(Game.Objects['Grandma'].plural), 2])}<br>${loc('Dropped by %1 plants.', loc('Elderwort').toLowerCase())}`
	Game.Upgrades['Bakeberry cookies'].baseDesc = `${getStrCookieProductionMultiplierPlus(2)}<br>${loc('Dropped by %1 plants.', loc('Bakeberry').toLowerCase())}`
	Game.Upgrades['Duketater cookies'].baseDesc = `${getStrCookieProductionMultiplierPlus(10)}<br>${loc('Dropped by %1 plants.', loc('Duketater').toLowerCase())}`
	Game.Upgrades['Green yeast digestives'].baseDesc = `${loc('Golden cookies give <b>%1%</b> more cookies.', 1)}<br>${loc('Golden cookie effects last <b>%1%</b> longer.', 1)}<br>${loc('Golden cookies appear <b>%1%</b> more often.', 1)}<br>${loc('Random drops are <b>%1% more common</b>.', 3)}<br>${loc('Dropped by %1 plants.', loc('Green rot').toLowerCase())}`
	Game.Upgrades['Wheat slims'].baseDesc = `${getStrCookieProductionMultiplierPlus(1)}<br>${loc('Dropped by %1 plants.', loc('Baker\'s wheat').toLowerCase())}`

	// ゲーム開始時と概要欄が変わってしまうため、バレンタインのアップグレードの再翻訳
	for (let heart of Game.heartDrops) {
		let obj = Game.Upgrades[heart]
		obj.baseDesc = getStrCookieProductionMultiplierPlus(2)
	}

	// アップグレードフレーバーテキスト
	for (let upg in Game.Upgrades) {
		let obj = Game.Upgrades[upg]
		let qpos = obj.baseDesc.indexOf('<q>')
		if (qpos >= 0) {
			obj.baseDesc = obj.baseDesc.substring(0, qpos)
		}
		obj.ddesc = BeautifyInText(obj.baseDesc)
		let quote = loc(FindLocStringByPart('Upgrade quote ' + obj.id))
		if (quote) {
			obj.baseDesc += `<q>${quote}</q>`
			obj.ddesc += `<q>${quote}</q>`
		}
	}

	// ティアあり実績概要
	for (let result of funcInitString.matchAll(/Game\.TieredAchievement\('(.+?)(?<!\\)',/g)) {
		let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
		obj.baseDesc = loc('Have <b>%1</b>.', loc('%1 ' + obj.buildingTie.bsingle, LBeautify(Game.Tiers[obj.tier].achievUnlock)))
	}

	// 施設別生産量実績概要
	for (let result of funcInitString.matchAll(/Game\.ProductionAchievement\('(.+?)(?<!\\)','(.+?)',(\d+?)(?:,(\d+?),(\d+?))?\);/g)) {
		let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
		let building = Game.Objects[result[2].replaceAll('\\\'', '\'')]
		let n = 12 + building.n + (typeof (result[5]) === 'undefined' ? 0 : Number(result[5])) + 7 * (Number(result[3]) - 1)
		let pow = Math.pow(10, n)
		obj.baseDesc = loc('Make <b>%1</b> just from %2.', [loc('%1 cookie', { n: pow, b: toFixed(pow) }), building.plural])
	}

	// 全体生産量実績概要
	for (let result of funcInitString.matchAll(/Game\.BankAchievement\('(.+?)(?<!\\)'/g)) {
		let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
		obj.baseDesc = loc('Bake <b>%1</b> in one ascension.', loc('%1 cookie', { n: obj.threshold, b: toFixed(obj.threshold) }))
	}

	// その他実績概要
	for (let result of funcInitString.matchAll(/new Game\.Achievement\('(.+?)(?<!\\)',(.+?),\[\d+?,\d+?\]\);/g)) {
		let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
		obj.baseDesc = Function('return ' + result[2])()
	}

	// 施設レベル実績概要
	for (let i in Game.Objects) {
		if (Game.Objects[i].levelAchiev10) {
			Game.Objects[i].levelAchiev10.baseDesc = loc('Reach level <b>%1</b> %2.', [10, Game.Objects[i].plural])
			Game.Objects[i].levelAchiev10.desc = Game.Objects[i].levelAchiev10.baseDesc
		}
	}

	// 実績フレーバーテキスト
	for (let acv in Game.Achievements) {
		let obj = Game.Achievements[acv]
		let qpos = obj.baseDesc.indexOf('<q>')
		if (qpos >= 0) {
			obj.baseDesc = obj.baseDesc.substring(0, qpos)
		}
		obj.ddesc = BeautifyInText(obj.baseDesc)
		let quote = loc(FindLocStringByPart('Achievement quote ' + obj.id))
		if (typeof (quote) !== 'undefined') {
			obj.baseDesc += `<q>${quote}</q>`
			obj.ddesc += `<q>${quote}</q>`
		}
	}

	// ミニゲーム菜園関連の再翻訳
	if (betterJapanese.isAvailableMinigame('Farm')) {
		while (!Game.Objects['Farm'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
		let Mg = Game.Objects['Farm'].minigame
		const funcFarmInitString = Mg.init.toString().replace(/[\r\n\t]/g, '')

		// 作物の再翻訳
		let plantsString = funcFarmInitString.match(/M\.plants=\{(.+?)\};/)[1]
		for (let res of plantsString.matchAll(/'([^']+?)':\{name:'(.+?)(?<!\\)',.+?,effsStr:(.+?),q:/g)) {
			let plant = Mg.plants[res[1]]
			plant.name = loc(res[2].replaceAll('\\\'', '\''))
			plant.effsStr = Function('return ' + res[3])()
		}

		// 土の再翻訳
		let soilsString = funcFarmInitString.match(/M\.soils=\{(.+?)\};/)[1]
		for (let res of soilsString.matchAll(/'([^']+?)':\{name:loc\("(.+?)(?<!\\)"\),.+?,effsStr:(.+?),q:/g)) {
			let soil = Mg.soils[res[1]]
			soil.name = loc(res[2])
			soil.effsStr = Function('return ' + res[3])()
		}

		// ツールの再翻訳
		for (let res of funcFarmInitString.substring(funcFarmInitString.indexOf('M.tools=')).matchAll(/'([^']+?)':\{name:loc\("(.+?)"\),.+?,(?:desc:(.+?),)?(?:descFunc|func):/g)) {
			let tool = Mg.tools[res[1]]
			tool.name = loc(res[2])
			if (res[3]) {
				tool.desc = Function('return ' + res[3])()
			}
		}
	}

	// ミニゲーム神殿関連の再翻訳
	if (betterJapanese.isAvailableMinigame('Temple')) {
		while (!Game.Objects['Temple'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
		Mg = Game.Objects['Temple'].minigame

		// 精霊の再翻訳
		for (let res of Mg.init.toString().replace(/[\r\n\t]/g, '').matchAll(/'([^']+?)':\{.+?,desc1:(.+?),desc2:(.+?),desc3:(.+?),(?:descAfter:(.+?),)?quote:/g)) {
			let god = Mg.gods[res[1]]
			god.name = loc(FindLocStringByPart(`GOD ${god.id + 1} NAME`))
			god.quote = loc(FindLocStringByPart(`GOD ${god.id + 1} QUOTE`))
			god.desc1 = Function('return ' + res[2])()
			god.desc2 = Function('return ' + res[3])()
			god.desc3 = Function('return ' + res[4])()
			if (res[5]) {
				god.descAfter = Function('return ' + res[5])()
			}
		}

		// メイン画面を再翻訳
		l('templeSwaps').onmosueover = GetTooltipFunc(`<div style="padding:8px;width:350px;font-size:11px;text-align:center;">${loc('Each time you slot a spirit, you use up one worship swap.<div class="line"></div>If you have 2 swaps left, the next one will refill after %1.<br>If you have 1 swap left, the next one will refill after %2.<br>If you have 0 swaps left, you will get one after %3.<div class="line"></div>Unslotting a spirit costs no swaps.', [Game.sayTime(60 * 60 * 1 * Game.fps), Game.sayTime(60 * 60 * 4 * Game.fps), Game.sayTime(60 * 60 * 16 * Game.fps)])}</div>`)
	}

	// ミニゲーム在庫市場関連の再翻訳
	if (betterJapanese.isAvailableMinigame('Bank')) {
		while (!Game.Objects['Bank'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
		Mg = Game.Objects['Bank'].minigame
		const funcBunkInitString = Mg.init.toString().replaceAll(/[\r\n\t]/g, '')

		// オフィスの再翻訳
		let counter = 0
		for (let res of funcBunkInitString.match(/M\.offices=\[(.+?)\];/)[1].matchAll(/{name:loc\("(.+?)"\),.+?,desc:(.+?)},/g)) {
			Mg.offices[counter].name = loc(res[1])
			Mg.offices[counter].desc = Function('return ' + res[2])()
			counter++
		}

		// ローンの再翻訳
		counter = 0
		for (let res of funcBunkInitString.match(/M\.loanTypes=\[(.+?)\];/)[1].matchAll(/\[loc\("(.+?)"\),.+?,loc\("(.+?)"\)\]/g)) {
			Mg.loanTypes[counter][0] = loc(res[1])
			Mg.loanTypes[counter][6] = loc(res[2])
			counter++
		}

		// メイン画面を再翻訳
		l('bankHeader').children[0].children[0].innerHTML = loc('Profits: %1. All prices are in $econds of your highest raw cookies per second.', '<span id="bankBalance">$0</span>') + ' <span id="bankNextTick"></span>'
		l('bankBrokersBuy').innerHTML = loc('Hire')
		for (let i = 1; i <= 3; i++) {
			l('bankLoan' + i).innerHTML = loc('Loan #%1', i)
		}
		const buyStr = loc('Buy')
		const sellStr = loc('Sell')
		for (let i = 0; i < Mg.goodsById.length; i++) {
			let good = Mg.goodsById[i]
			good.name = loc(FindLocStringByPart(`STOCK ${i + 1} TYPE`))
			good.symbol = loc(FindLocStringByPart(`STOCK ${i + 1} LOGO`))
			good.company = loc(FindLocStringByPart(`STOCK ${i + 1} NAME`))
			let goodDiv = l('bankGood-' + i)
			let bankSymbols = goodDiv.children[0].querySelectorAll('.bankSymbol')
			let str = bankSymbols[0].innerHTML
			bankSymbols[0].innerHTML = `${good.symbol} ${str.substring(str.indexOf('<'))}`
			str = bankSymbols[1].innerHTML
			bankSymbols[1].innerHTML = `${loc('value:')} ${str.substring(str.indexOf('<'))}`
			str = bankSymbols[2].innerHTML
			bankSymbols[2].innerHTML = `${loc('stock:')} ${str.substring(str.indexOf('<'))}`
			good.symbolNumL = l(`bankGood-${good.id}-sym`)
			good.valL = l(`bankGood-${good.id}-val`)
			good.stockL = l(`bankGood-${good.id}-stock`)
			good.stockMaxL = l(`bankGood-${good.id}-stockMax`)
			bankSymbols = goodDiv.children[1].querySelectorAll('.bankSymbol')
			for (let j = 0; j <= 1; j++) {
				bankSymbols[j].style['display'] = (buyStr.length > 4 || sellStr.length > 4) ? 'block' : ''
				bankSymbols[j].style['padding'] = (buyStr.length > 4 || sellStr.length > 4) ? '0px' : ''
				bankSymbols[j].style['width'] = (buyStr.length > 4 || sellStr.length > 4) ? '100%' : ''
			}
			bankSymbols[0].innerHTML = buyStr
			bankSymbols[1].innerHTML = sellStr
			l(`bankGood-${i}_Max`).innerHTML = cap(loc('max'))
			l(`bankGood-${i}_-All`).innerHTML = cap(loc('all'))
		}
		l('bankGraphLines').innerHTML = loc('Line style')
		l('bankGraphCols').innerHTML = loc('Color mode')
		if (l('bankCheatSpeeda') != null) {
			l('bankCheatSpeeda').innerHTML = loc('Toggle speed')
		}
		l('bankGraphBox').children[1].innerHTML = loc('DOUGH JONES INDEX')
	}

	// ミニゲーム魔導書関連の再翻訳
	if (betterJapanese.isAvailableMinigame('Wizard tower')) {
		while (!Game.Objects['Wizard tower'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
		Mg = Game.Objects['Wizard tower'].minigame

		// 魔法を再翻訳
		for (let res of Mg.init.toString().replace(/[\r\n\t]/g, '').matchAll(/'((?:[^']|\\')+?)(?<!\\)':\{name:loc\("(.+?)"\),desc:(.+?),(?:failDesc:(.+?),)?icon:/g)) {
			let spell = Mg.spells[res[1].replaceAll('\\\'', '\'')]
			spell.name = loc(res[2])
			spell.desc = Function('return ' + res[3])()
			if (res[4]) {
				spell.failDesc = Function('return ' + res[4])()
			}
		}

		// 魔法メーターのツールチップを再翻訳
		l('grimoireBarText').nextElementSibling.onmouserover = GetTooltipFunc(`<div style="padding:8px;width:300px;font-size:11px;text-align:center;">${loc('This is your magic meter. Each spell costs magic to use.<div class="line"></div>Your maximum amount of magic varies depending on your amount of <b>Wizard towers</b>, and their level.<div class="line"></div>Magic refills over time. The lower your magic meter, the slower it refills.')}</div>`)
	}

	Game.RebuildUpgrades()
	Game.BuildStore()

	// トップバー
	Game.attachTooltip(
		l('topbarOrteil'),
		'<div style="padding:8px;width:250px;text-align:center;">Orteilのサブドメインに戻るよ!<br>他のゲームがたくさんあるよ!</div>',
		'this'
	)
	Game.attachTooltip(
		l('topbarDashnet'),
		'<div style="padding:8px;width:250px;text-align:center;">私たちのホームページに戻るよ!</div>',
		'this'
	)
	Game.attachTooltip(
		l('topbarTwitter'),
		'<div style="padding:8px;width:250px;text-align:center;">ゲームの更新をたまに告知する、Orteilのtwitterだよ。</div>',
		'this'
	)
	Game.attachTooltip(
		l('topbarTumblr'),
		'<div style="padding:8px;width:250px;text-align:center;">ゲームの更新をたまに告知する、Orteilのtumblrだよ。</div>',
		'this'
	)
	Game.attachTooltip(
		l('topbarDiscord'),
		'<div style="padding:8px;width:250px;text-align:center;">私たちの公式Discordサーバーだよ。<br>CookieClickerや他のゲームの質問や小技を共有できるよ!</div>',
		'this'
	)
	l('topbarMerch').innerHTML = '買ってね!'
	Game.attachTooltip(
		l('topbarMerch'),
		'<div style="padding:8px;width:250px;text-align:center;">CookieClickerシャツ、フード、ステッカーが!</div>',
		'this'
	)
	Game.attachTooltip(
		l('topbarPatreon'),
		'<div style="padding:8px;width:250px;text-align:center;">Patreonで支援してCookieClickerの更新を援助してね!<br>パトロンには素敵なご褒美も!</div>',
		'this'
	)
	l('topbarMobileCC').innerHTML = 'Android版CookieClicker'
	Game.attachTooltip(
		l('topbarMobileCC'),
		'<div style="padding:8px;width:250px;text-align:center;">スマホでCookieClickerを遊ぼう!<br>(Androidだけです。iOSバージョンは後ほど)</div>',
		'this'
	)
	l('topbarSteamCC').innerHTML = 'Steam版CookieClicker'
	Game.attachTooltip(
		l('topbarSteamCC'),
		'<div style="padding:8px;width:250px;text-align:center;">Steam上でCookieClickerを入手しよう!<br>音楽はC418さんが監修。</div>',
		'this'
	)
	Game.attachTooltip(
		l('topbarRandomgen'),
		'<div style="padding:8px;width:250px;text-align:center;">ランダム生成機で何か書けるように作ったよ。</div>',
		'this'
	)
	Game.attachTooltip(
		l('topbarIGM'),
		'<div style="padding:8px;width:250px;text-align:center;">シンプルなスクリプト言語でオリジナル放置ゲームを作れるように作ったよ。</div>',
		'this'
	)

	l('linkVersionBeta').innerHTML = 'ベータテストに参加!'
	l('links').children[0].children[2].innerHTML = 'クラシック'

	const getNumber = (str) => {
		const isExp = str.match(/[+-]?\d+(?:\.\d+)?[eE][+-]?\d+/)
		if (isExp) return isExp[0]

		let res = str.match(/(\d+)((?:,\d+)+)?(.\d+)?( \w+)?/)
		let newval
		if (res) {
			newval = res[1]
			if (res[2]) newval += res[2].replace(/,/g, '')
			if (res[3]) newval += res[3]
			newval = Number(newval)
			if (res[4]) newval *= 1000 ** (formatLong.indexOf(res[4]) + 1)
			return newval
		}
	}

	// 通知欄の再翻訳
	const researchUpgrades = Object.values(Game.Upgrades).filter(v => v.pool === 'tech')
	for (let note of Game.Notes) {
		let icon = JSON.stringify(note.pic)
		if (icon === JSON.stringify([25, 7])) {
			// バックアップ催促の通知
			note.title = loc('Back up your save!')
			note.desc = `${loc('Hello again! Just a reminder that you may want to back up your Cookie Clicker save every once in a while, just in case.<br>To do so, go to Options and hit "Export save" or "Save to file"!')}<div class="line"></div><a style="float:right;" onclick="Game.prefs.showBackupWarning=0;==CLOSETHIS()==">${loc('Don\'t show this again')}</a>`.replaceAll('==CLOSETHIS()==', 'Game.CloseNote(' + note.id + ');')
		} else if (note.pic[1] === 11 && note.pic[0] >= 0 && note.pic[0] < 16) {
			// オフライン中の収入の通知
			let number = getNumber(note.desc)
			if (number) {
				note.title = loc('Welcome back!')
				note.desc = loc('You earned <b>%1</b> while you were away.', loc('%1 cookie', LBeautify(number)))
			}
		} else if (icon === JSON.stringify([20, 3])) {
			// バレンタインシーズン開始の通知
			note.title = loc('Valentine\'s Day!')
			note.desc = loc('It\'s <b>Valentine\'s season</b>!<br>Love\'s in the air and cookies are just that much sweeter!')
		} else if (icon === JSON.stringify([17, 6])) {
			// ビジネスシーズン開始の通知
			note.title = loc('Business Day!')
			note.desc = loc('It\'s <b>Business season</b>!<br>Don\'t panic! Things are gonna be looking a little more corporate for a few days.')
		} else if (icon === JSON.stringify([13, 8])) {
			// ハロウィンシーズン開始の通知
			note.title = loc('Halloween!')
			note.desc = loc('It\'s <b>Halloween season</b>!<br>Everything is just a little bit spookier!')
		} else if (icon === JSON.stringify([12, 10])) {
			// クリスマスシーズン開始の通知
			note.title = loc('Christmas time!')
			note.desc = loc('It\'s <b>Christmas season</b>!<br>Bring good cheer to all and you just may get cookies in your stockings!')
		} else if (icon === JSON.stringify([0, 12])) {
			// イースターシーズン開始の通知
			note.title = loc('Easter!')
			note.desc = loc('It\'s <b>Easter season</b>!<br>Keep an eye out and you just might click a rabbit or two!')
		} else if (icon === JSON.stringify([29, 14])) {
			// オフライン中の角砂糖収穫の通知
			let number = getNumber(note.desc)
			if (number) {
				note.desc = loc('You harvested <b>%1</b> while you were away.', loc('%1 sugar lump', LBeautify(number)))
			}
		} else {
			// オフライン中の研究終了の通知
			const result = researchUpgrades.filter(u => u.icon === Game.Notes[0].pic)
			if (result.length > 0) {
				note.title = loc('Research complete')
				note.desc = loc('You have discovered: <b>%1</b>.', result[0].dname)
			}
		}
	}
	Game.UpdateNotes()
}

if (typeof betterJapanese !== 'undefined') rebuildLocalization()
