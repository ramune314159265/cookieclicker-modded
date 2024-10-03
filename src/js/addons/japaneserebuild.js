async function rebuildLocalization() {
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
}

if (typeof betterJapanese !== 'undefined') rebuildLocalization()
