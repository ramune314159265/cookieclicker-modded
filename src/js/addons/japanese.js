const betterJapanese = {
    name: 'betterJapanese',
    version: null,
    config: {
        hash: '0',
        replaceJP: true,
        replaceTime: true,
        replaceBackgroundName: true,
        replaceMarketQuote: true,
        replaceGardenImage: true,
        replaceUpdateLog: true,
        replaceSpecialUpgrades: true,
        replacePurchasedTag: true,
        replaceBuildings: true,
        replaceCSS: true,
        replaceNews: true,
        replaceOthers: true,
        showSpoilerAlert: true,
        beautifyAscendNumber: true,
        numberJP: true,
        shortFormatJP: false,
        secondFormatJP: true,
        ignoreList: []
    },
    api: {
        url: {
            release: 'https://pages.yukineko.me/better-japanese/api/release.json',
            dev: '../mods/local/better-japanese'
        },
        endpoints: {
            'TRANSLATE': null,
            'CATEGORY': null
        },
        cache: null
    },
    isDev: false,
    initialized: false,
    fallbackTimer: 0,
    origins: {},
    formats: {
        prefix: ['', '万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極', '恒河沙'], // 万進法用の単位
        suffixes: [], // 上数用の単位
        short: [] // 塵劫記用の単位
    },
    tmpIgnoreList: {},
    tmpCategoryList: {},
    currentIgnoreList: [],
    isRegisteredHook: false,
    isLoadedConfig: false,
    isShowedUnitChangeNotify: false,

    init: function() {
        let versionPath = App ? `file:///${App.mods['BetterJapanese'].dir.replace(/\\/g, '/')}/version.json` : 'https://pages.yukineko.me/better-japanese/version.json'
        this.getJSON(versionPath).then(res => {
            this.version = res ? res.version : '0.0.0'
        })

        this.fallbackTimer = setTimeout(() => {
            this.checkUpdate()
            this.initialized = true
        }, 5000)

        if (App) send({ id: 'init bridge' })

        this.initAfterLoad()

        // Web版で既にDOMが構築されていた場合はDOMを再構成するスクリプトを読み込む (一部の翻訳が適用されないため)
        if (!App && Game.ready) Game.LoadMod('./js/addons/japaneserebuild.js')

        this.log('Initialized')
    },

    initAfterLoad: async function() {
        betterJapanese.load()

        // メニューに独自ボタンを実装
        if (typeof Game.customMenu !== 'undefined') {
            // CCSEのメニューインジェクションが利用できる場合はそちらを利用する
            Game.customMenu.push(() => {
                if (Game.onMenu == 'prefs') {
                    betterJapanese.injectMenu()
                }

                if (Game.onMenu == 'stats') {
                    betterJapanese.injectStats()
                }
            })
        } else {
            // CCSEがなければ独自実装で追加
            // この方法で追加しないと他のメニュー独自実装Modと競合してしまう
            let origin = Game.UpdateMenu.toString().split('\n')
            origin.splice(origin.length - 1, 0, `
                if (Game.onMenu == 'prefs') {
                    betterJapanese.injectMenu()
                }

                if (Game.onMenu == 'stats') {
                    betterJapanese.injectStats()
                }
            `)
            Function(`Game.UpdateMenu = ${origin.join('\n')}`)()
        }

        // カスタムCSSを適用
        let customStyle = document.createElement('style')
        customStyle.innerHTML = `
        #prompt.settingsList {
            width: 40vw;
            left: -20vw;
        }

        #prompt.ignoreList {
            width: 50vw;
            left: -25vw;
        }

        #prompt input {
            width: auto;
            margin: 4px;
        }

        .accordion-parent {
            display: none;
        }

        .accordion-child {
            display: none;
        }

        .accordion-parent:checked + label + .accordion-child {
            display: block;
        }

        .accordion-parent + label > li:after {
            content: "▼";
            margin-left: 10px;
            background-color: #555;
            padding: 2px;
            border-radius: 8px;
        }

        .accordion-parent:checked + label > li:after {
            content: "▲";
        }

        #prompt label > li {
            margin: 5px 0;
            padding: 5px;
            background: #222;
        }

        #prompt .accordion-words li {
            margin: 0px;
            padding: 0px 0px 0px 4px;
        }

        #prompt .accordion-words li label {
            display: flex;
            align-items: flex-start;
        }

        #prompt .accordion-words div {
            margin-top: 4px;
        }

        #prompt .accordion-words ul {
            list-style-type: disc;
        }

        #prompt .accordion-words ul ul {
            list-style-type: circle;
        }

        #prompt .accordion-words ul ul ul {
            list-style-type: square;
        }

        #prompt .accordion-words div li {
            padding: 0px;
            margin: 0px;
        }

        #prompt ul ul {
            list-style: none;
            padding-left: 20px;
        }
        `
        document.head.appendChild(customStyle)

        if (betterJapanese.config.beautifyAscendNumber) {
            if (!betterJapanese.origins.logic) betterJapanese.origins.logic = Game.Logic
            Game.Logic = Function(betterJapanese.origins.logic.toString().replace(/^(?:[^\{])+\{((?:.|[\r\n\t])+)\}/, '$1').replace('Game.ascendNumber.textContent=\'+\'+SimpleBeautify(ascendNowToGet);', 'Game.ascendNumber.textContent=\'+\'+Beautify(ascendNowToGet);'))
            let customStyle = document.createElement('style')
            customStyle.innerHTML = `
            #ascendNumber {
                white-space: nowrap;
            }
            `
            document.head.appendChild(customStyle)
        }

        // 設定の「日本語訳の改善」がOFFになっている場合はここから下は実行しない (ニュース欄やアップデート履歴が壊れる)
        if (!betterJapanese.config.replaceJP) return

        if (!betterJapanese.origins.parseLoc) betterJapanese.origins.parseLoc = parseLoc
        parseLoc = function(str, params) {
            // 独自実装されている翻訳でコケないように修正
            if (str.constructor === Object) return ''

            // 翻訳対象の文章の末尾に%が付いている場合に消えてしまう問題を修正
            let baseStr = betterJapanese.origins.parseLoc(str, params)
            if (typeof str === 'string' && str.endsWith('%')) baseStr += '%'
            return baseStr
        }

        // 時間表記からカンマを取り除く
        if (betterJapanese.config.replaceTime) {
            if (!betterJapanese.origins.sayTime) betterJapanese.origins.sayTime = Game.sayTime
            Game.sayTime = function(time, detail) {
                return betterJapanese.origins.sayTime(time, detail).replaceAll(', ', '')
            }
        }

        // 背景の名前を翻訳
        if (betterJapanese.config.replaceBackgroundName) {
            for (let i = 1; i < Game.AllBGs.length; i++) {
                Game.AllBGs[i].enName = Game.AllBGs[i].name
                Game.AllBGs[i].name = loc(Game.AllBGs[i].enName)
            }
        }

        // 在庫市場のquoteを実装
        if (betterJapanese.config.replaceMarketQuote && betterJapanese.isAvailableMinigame('Bank')) {
            while (!Game.Objects['Bank'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
            if (!betterJapanese.origins.goodTooltip) betterJapanese.origins.goodTooltip = Game.Objects['Bank'].minigame.goodTooltip
            Game.Objects['Bank'].minigame.goodTooltip = function(id) {
                return function() {
                    let desc = betterJapanese.origins.goodTooltip(id)()
                    const qbefore = '<div class="line"></div>'
                    let qpos = desc.indexOf(qbefore) + qbefore.length
                    return `${desc.substring(0, qpos)}<div class="description"><q>${loc(Game.Objects['Bank'].minigame.goodsById[id].desc)}</q><div class="line">${desc.substring(qpos)}`
                }
            }
        }

        // 菜園情報の画像を差し替え
        if (betterJapanese.config.replaceGardenImage && betterJapanese.isAvailableMinigame('Farm')) {
            while (!Game.Objects['Farm'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
            if (!betterJapanese.origins.toolInfoDescFunc) betterJapanese.origins.toolInfoDescFunc = Game.Objects['Farm'].minigame.tools['info'].descFunc

            Game.Objects['Farm'].minigame.tools['info'].descFunc = function() {
                return betterJapanese.origins.toolInfoDescFunc().replace('images/gardenTip.png', 'https://pages.yukineko.me/better-japanese/assets/gardenTip.png').replace(/^[^\{]+?\{(.+)\}$/, '$1')
            }
        }

        // 情報欄の翻訳
        if (betterJapanese.config.replaceUpdateLog) {
            if (!betterJapanese.origins.updateLog) betterJapanese.origins.updateLog = Game.updateLog
            Game.updateLog = `
                <div class="selectable">
                    <div class="section">${loc('Info')}</div>
                    <div class="subsection">
                        <div class="title">${loc('About')}</div>
                        ${(App ? `<div class="listing" style="font-weight:bold;font-style:italic;opacity:0.5;">${loc('Note: links will open in your web browser.')}</div>` : '')}
                        <div class="listing">
                            ${loc('Cookie Clicker is a javascript game by %1 and %2.', [
                                '<a href="//orteil.dashnet.org" target="_blank">Orteil</a>',
                                '<a href="//dashnet.org" target="_blank">Opti</a>'
                            ])}
                        </div>
                        ${(App ? `<div class="listing">${loc('Music by %1.', '<a href="https://twitter.com/C418" target="_blank">C418</a>')}</div>` : '')}
                        <div class="listing">
                            ${loc('We have an %1; if you\'re looking for help, you may also want to visit the %2 or the %3.<br>News and teasers are usually posted on Orteil\'s %4 and %5.', [
                                `<a href="https://discordapp.com/invite/cookie" target="_blank">${loc('official Discord')}</a>`,
                                '<a href="https://www.reddit.com/r/CookieClicker" target="_blank">subreddit</a>',
                                '<a href="https://cookieclicker.wikia.com/wiki/Cookie_Clicker_Wiki" target="_blank">wiki</a>',
                                '<a href="https://orteil42.tumblr.com/" target="_blank">tumblr</a>',
                                '<a href="https://twitter.com/orteil42" target="_blank">twitter</a>',
                            ])}
                        </div>
                        ${(!App ? `<div class="listing block" style="margin:8px 32px;font-size:11px;line-height:110%;color:rgba(200,200,255,1);background:rgba(128,128,255,0.15);" id="supportSection">
                            ${loc('This version of Cookie Clicker is 100% free, forever. Want to support us so we can keep developing games? Here\'s some ways you can help:%1', [`<br><br>
                                &bull; ${loc('get %1 (it\'s about 5 bucks)', `<a href="https://store.steampowered.com/app/1454400/Cookie_Clicker/" target="_blank" class="highlightHover smallWhiteButton">${loc('Cookie Clicker on Steam')}</a>`)}<br><br>
                                &bull; ${loc('support us on %1 (there\'s perks!)', '<a href="https://www.patreon.com/dashnet" target="_blank" class="highlightHover smallOrangeButton">Patreon</a>')}<br><br>
                                &bull; ${loc('check out our %1 with rad cookie shirts, hoodies and stickers', `<a href="http://www.redbubble.com/people/dashnet" target="_blank" class="highlightHover smallWhiteButton">${loc('Shop')}</a>`)}<br><br>
                                &bull; ${loc('disable your adblocker (if you want!)')}
                            `])}
                        </div>
                    </div>` : '')}
                    <div class="listing warning">${loc('Note: if you find a new bug after an update and you\'re using a 3rd-party add-on, make sure it\'s not just your add-on causing it!')}</div>
                    ${(!App ? (`<div class="listing warning">
                        ${loc('Warning: clearing your browser cache or cookies <small>(what else?)</small> will result in your save being wiped. Export your save and back it up first!')}
                    </div>`) : '')}
                </div>
                <div class="subsection">
                <div class="title">${loc('Version history')}</div>`
            let logUpdates = ''
            let logPerUpdate = ''
            let logIndex = ''
            let logResult = []
            let logId = 0
            while (typeof (logIndex = FindLocStringByPart(`Update notes ${logId}`)) === 'string' && typeof (logResult = loc(logIndex)) === 'object' && logResult.length > 1) {
                let logOptions = logIndex.substring(logIndex.indexOf(']') + 1).split('|')
                let isSmallList = false, isAppList = false
                if (logOptions.includes('small')) isSmallList = true
                if (logOptions.includes('app')) isAppList = true
                if ((App && isAppList) || !isAppList) {
                    logPerUpdate = `<div class="subsection update${isSmallList ? ' small' : ''}">`
                    logPerUpdate += `<div class="title">${logResult[0]}</div>`
                    for (let i = 1; i < logResult.length; i++) {
                        let options = logResult[i].split('|')
                        let str = options.pop()
                        let isAppItem = false
                        let stylePosition = -1
                        if (options.length > 0) {
                            if (options.includes('app')) isAppItem = true
                            if (options.includes('style')) stylePosition = options.indexOf('style') + 1
                        }
                        if ((App && isAppItem) || !isAppItem) {
                            str = str.replaceAll('[Update Log General Names]', choose(loc('[Update Log General Names]')))
                            logPerUpdate += `<div class="listing"${stylePosition >= 0 && stylePosition < options.length ? `style="${options[stylePosition]}"` : ''}>${str}</div>`
                        }
                    }
                    logUpdates = `${logPerUpdate}</div>${logUpdates}`
                }
                logId++
            }
            Game.updateLog += `</div>${logUpdates}</div></div>`
        }

        // 特殊なフレーバーテキストや概要を持つアップグレードの翻訳
        if (betterJapanese.config.replaceSpecialUpgrades) {
            // 巡り続ける読本のフレーバーテキスト翻訳、thisを使うので非ラムダ式(以降同様)
            let upgrade = Game.Upgrades['Endless book of prose']
            upgrade.desc = loc('%1 are <b>twice</b> as efficient.', cap(upgrade.buildingTie1.plural))
            if(!upgrade.originDescFunc) upgrade.originDescFunc = upgrade.descFunc
            upgrade.descFunc = function() {
                let str = loc(FindLocStringByPart(`Upgrade quote ${this.id}`), Game.bakeryName)
                let n = 26
                let i = Math.floor(Game.T * 0.1)
                let originDesc = this.originDescFunc()
                if (originDesc.indexOf('<q>') >= 0) {
                    originDesc = originDesc.substring(0, originDesc.indexOf('<q>'))
                }
                return `${originDesc}<q style="font-family:Courier;">${str.substr(i % str.length, n) + (i % str.length > (str.length - n) ? str.substr(0, i % str.length - (str.length - n)) : '')}</q>`
            }

            // マウス達をクリックするマウス達のフレーバーテキスト翻訳
            upgrade = Game.Upgrades['Mice clicking mice']
            upgrade.desc = betterJapanese.createSynergyUpgradeDesc(upgrade)
            upgrade.descFunc = function() {
                Math.seedrandom(Game.seed + '-blasphemouse')
                if (Math.random() < 0.3) {
                    Math.seedrandom()
                    return `${this.desc}<q>${loc(FindLocStringByPart(`Upgrade quote ${this.id}`))}</q>`
                }

                Math.seedrandom()
                return `${this.desc}<q>${loc('Mice clicking mice (Absolutely blasphemouse!)')}</q>`
            }

            // 富くじ演算のフレーバーテキスト翻訳
            upgrade = Game.Upgrades['Tombola computing']
            upgrade.desc = betterJapanese.createSynergyUpgradeDesc(upgrade)
            upgrade.descFunc = function() {
                Math.seedrandom(Game.seed + '-tombolacomputing')
                let str = loc(FindLocStringByPart(`Upgrade quote ${this.id}`), [
                    Math.floor(Math.random() * 100),
                    Math.floor(Math.random() * 100),
                    Math.floor(Math.random() * 100),
                    Math.floor(Math.random() * 100),
                    parseLoc(choose(loc('Tombola computing (Base)')), [
                        Math.floor(Math.random() * 5 + 2),
                        choose(loc('Tombola computing (Color)')),
                        choose(loc('Tombola computing (Living)'))
                    ])
                ])
                Math.seedrandom()
                return `${this.desc}<q>${str}</q>`
            }

            // 一級品の壁紙アソートメントの説明翻訳
            Game.Upgrades['Distinguished wallpaper assortment'].desc = loc('Contains more wallpapers for your background selector.')

            // ゴールデンスイッチの説明翻訳
            let func = function() {
                if (!Game.Has('Residual luck')) return this.ddesc

                let bonus = 0
                let upgrades = Game.goldenCookieUpgrades
                for (let i in upgrades) {
                    if (Game.Has(upgrades[i])) bonus++
                }

                return `<div style="text-align:center;">${Game.listTinyOwnedUpgrades(Game.goldenCookieUpgrades)}<br><br>${loc('The effective boost is <b>+%1%</b><br>thanks to %2<br>and your <b>%3</b> %4.', [Beautify(Math.round(50 + bonus * 10)), getUpgradeName('Residual luck'), bonus, loc('golden cookie upgrade', bonus)])}</div><div class="line"></div>${this.ddesc}`
            }

            Game.Upgrades['Golden switch [off]'].descFunc = func
            Game.Upgrades['Golden switch [on]'].descFunc = func
        }

        // 猫の場合「購入済み」タグが変化することを翻訳にも反映
        if (betterJapanese.config.replacePurchasedTag) {
            if (!betterJapanese.origins.crateTooltip) betterJapanese.origins.crateTooltip = Game.crateTooltip
            Game.crateTooltip = function(me, context) {
                let tooltipText = betterJapanese.origins.crateTooltip(me, context)
                if (Game.sesame) {
                    tooltipText = tooltipText.replace(/<div style="font-size:9px;">.*<\/div>/, `<div style="font-size:9px;">ID : ${me.id} | 順序 : ${Math.floor(me.order)}${me.tier ? ` | ティア : ${me.tier}` : ''}</div>`)
                }
                if (me.type == 'upgrade' && me.bought > 0 && me.pool != 'tech' && me.kitten) {
                    return tooltipText.replace(`<div class="tag" style="background-color:#fff;">${loc('Purchased')}</div>`, `<div class="tag" style="background-color:#fff;">${loc('[Tag]Purrchased')}</div>`)
                }
                return tooltipText
            }
        }

        // 施設固有の表現をツールチップに表示
        if (betterJapanese.config.replaceBuildings) {
            // 英語以外でも施設固有の生産方法をツールチップに表示
            for (let i in Game.Objects) {
                let obj = Game.Objects[i]
                if (!betterJapanese.origins.tooltip) betterJapanese.origins.tooltip = obj.tooltip
                obj.actionNameJP = loc(obj.actionName)
                obj.tooltip = function() {
                    const strDivDescriptionBlock = '<div class="descriptionBlock">'
                    let defaultTooltip = betterJapanese.origins.tooltip.bind(this)().split(strDivDescriptionBlock)
                    // Game.Object[X].tooltipのdescriptionBlockは存在しないか4つのどちらか
                    if (defaultTooltip.length > 1) {
                        defaultTooltip[4] = loc('<b>%1</b> %2 so far', [loc('%1 cookie', LBeautify(this.totalCookies)), this.actionNameJP]) + '</div>'
                        return defaultTooltip.join(strDivDescriptionBlock) + '</div>'
                    }
                    return defaultTooltip
                }
            }

            // 英語以外でも施設固有の角砂糖によるレベルアップの恩恵を表示
            for (let i in Game.Objects) {
                let obj = Game.Objects[i]
                if (!betterJapanese.origins.levelTooltip) betterJapanese.origins.levelTooltip = obj.levelTooltip
                obj.levelTooltip = function() {
                    const strDivLine = '<div class="line"></div>'
                    let defaultTooltip = betterJapanese.origins.levelTooltip.bind(this)().split(strDivLine)
                    defaultTooltip[1] = `${loc(this.extraName.replace('[X]', '%1'), Beautify(this.level))} ${loc('Granting <b>+%1% %2 CpS</b>.', [Beautify(this.level), this.single])}`
                    return defaultTooltip.join(strDivLine)
                }
            }
        }

        // フレーバーテキストが鍵括弧「」で囲われるように修正
        if (betterJapanese.config.replaceCSS) {
            let customStyle = document.createElement('style')
            customStyle.innerHTML = `
            .framed q:before {
                display:inline-block;
                content:"「" !important;
                font-size:14px;
                font-family:Georgia;
                font-weight:bold;
            }

            .framed q:after {
                display:inline-block;
                content:"」" !important;
                font-size:14px;
                font-family:Georgia;
                font-weight:bold;
                margin-top:-2px;
            }
            `
            document.head.appendChild(customStyle)
        }

        // ニュース欄の改善を有効化していれば置き換え
        if (betterJapanese.config.replaceNews) {
            // ニュースのフォーチュンクッキーの表示が壊れる問題を修正
            let tickerOrigin = Game.getNewTicker.toString().replace('me.name.indexOf(\'#\')', 'me.dname.indexOf(\'No.\')').replace(/me\.baseDesc/g, 'me.ddesc')
            Function(`Game.getNewTicker = ${tickerOrigin}`)()

            // ニュースを英語で出力させるように
            if (!betterJapanese.origins.getNewTicker) betterJapanese.origins.getNewTicker = Game.getNewTicker
            Game.getNewTicker = function(manual) {
                let isDefaultEN = EN
                EN = true
                betterJapanese.origins.getNewTicker(manual)
                if (!isDefaultEN) EN = false
            }

            // ニュースの文章を翻訳
            if (!betterJapanese.origins.tickerDraw) betterJapanese.origins.tickerDraw = Game.TickerDraw
            Game.TickerDraw = function() {
                Game.Ticker = betterJapanese.locTicker(Game.Ticker)
                betterJapanese.origins.tickerDraw()
            }
        }

        // その他破壊的な翻訳
        if (betterJapanese.config.replaceOthers) {
            // ミニゲームでの砂糖使用時に表示する確認ツールチップを翻訳
            if (!betterJapanese.origins.refillLump) betterJapanese.origins.refillLump = Game.refillLump
            Function('Game.refillLump = ' + Game.refillLump.toString().replace('\'refill\'', 'loc(\'refill\')'))()

            // イースターのエッグ解放時に表示するツールチップのアップグレード名を翻訳
            if (!betterJapanese.origins.dropEgg) betterJapanese.origins.dropEgg = Game.DropEgg
            Function('Game.DropEgg = ' + Game.DropEgg.toString().replace(/(Game\.Notify\(loc\("You found an egg\!"\),'\<b\>'\+)drop(\+'\<\/b\>',Game\.Upgrades\[drop\]\.icon\);)/, '$1Game.Upgrades[drop].dname$2'))()

            // 転生後に表示されるツールチップを翻訳
            if (!betterJapanese.origins.reincarnate) betterJapanese.origins.reincarnate = Game.Reincarnate
            Function('Game.Reincarnate = ' + Game.Reincarnate.toString().replace(/(Game\.Notify\()'Reincarnated'(,loc\("Hello, cookies!"\),\[10,0\],4\);)/, '$1loc("Reincarnated")$2'))()
        }
    },

    overrideBeautify: function() {
        // configが読み込まれていない可能性があるのでloadしておく
        betterJapanese.load()

        // 単位関係の初期化
        for (let suf of ['頻波羅', '矜羯羅', '阿伽羅']) {
            let len = betterJapanese.formats.suffixes.push(suf) - 1
            for (let i = 0; i < len; i++) {
                betterJapanese.formats.suffixes.push(betterJapanese.formats.suffixes[i] + suf)
            }
        }

        betterJapanese.formats.suffixes = ['', ...betterJapanese.formats.suffixes]

        // 塵劫記用の単位
        betterJapanese.formats.short = [...betterJapanese.formats.prefix, '阿僧祇', '那由多', '不可思議', '無量大数']

        // 設定によって日本語単位を使用するように変更、同時にカンマ区切りも場合によって変更
        if (!betterJapanese.origins.beautify) betterJapanese.origins.beautify = Beautify
        Beautify = function(val, floats) {
            let negative = (val < 0)
            let decimal = ''
            let fixed = val.toFixed(floats)
            if (floats > 0 && Math.abs(val) < 1000 && Math.floor(fixed) != fixed) decimal = '.' + (fixed.toString()).split('.')[1]
            val = Math.floor(Math.abs(val))
            if (floats > 0 && fixed == val + 1) val++
            let format = Game.prefs.format ? 2 : betterJapanese.config.numberJP ? 3 : 1
            let formatter = numberFormatters[format]
            let output = (val.toString().indexOf('e+') != -1 && format == 2) ? val.toPrecision(3).toString() : formatter(val).toString()
            if (Game.prefs.format || (betterJapanese.config.numberJP && betterJapanese.config.secondFormatJP)) {
                output = output.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            } else {
                output = output.replace(/^(\d)(\d{3})/, '$1,$2')
            }
            if (output == '0') negative = false
            return negative ? '-' + output : output + decimal
        }

        // 本家の挿入関数に追加
        numberFormatters = [
            formatEveryThirdPower(formatShort),
            formatEveryThirdPower(formatLong),
            rawFormatter,
            betterJapanese.formatEveryFourthPower()
        ]

        // 指数表記の場合表示が崩れる現象を修正
        if (!betterJapanese.origins.simpleBeautify) betterJapanese.origins.simpleBeautify = SimpleBeautify
        SimpleBeautify = function(val) {
            if (val.toString().indexOf('e+') >= 0) {
                return val.toString().replace(/(?<=.)(\d{3})(?=\d)/g, '$1,')
            }
            return betterJapanese.origins.simpleBeautify(val)
        }
    },

    save: function() {
        localStorage.setItem('BJPConfig', JSON.stringify(this.config))
    },

    load: function() {
        if (this.isLoadedConfig) return

        let conf = localStorage.getItem('BJPConfig')
        if (conf) this.config = Object.assign(this.config, JSON.parse(conf))
        this.isLoadedConfig = true
    },

    log: function(msg) {
        console.log(`%c[BetterJapanese]%c ${msg}`, 'color: yellow', '')
    },

    injectMenu: function() {
        let updateAll = () => {
            BeautifyAll()
            Game.RefreshStore()
            Game.upgradesToRebuild = 1

            if (!betterJapanese.isShowedUnitChangeNotify) {
                Game.Notify('日本語訳改善Mod', '単位の変更を検知しました。<br>変更後の単位を全ての要素に適用するには、再読み込みをしてください<br><a onclick="betterJapanese.reload()">セーブデータを保存して再読み込み</a>')
                betterJapanese.isShowedUnitChangeNotify = true
            }
        }

        let openSettings = () => {
            Game.Prompt(`
                <h3>非公式日本語訳 詳細設定</h3>
                <div>ゲームの処理を変更している翻訳処理について利用するか設定できます。<br>バグがあった場合、これらの翻訳はゲーム内容に影響を及ぼす可能性があります。</div>
                ${!betterJapanese.config.replaceJP ? '<div class="line"></div><p style="color: red; font-weight: bold;">「日本語訳の改善」がオフのため、下記の設定はすべてオフとして処理されます。</p>' : ''}
                <div class="line"></div>
                <div class="listing" style="width: 100%; text-align: left; padding: 0px 10px;">
                    <div id="dummyIgnoreListJP"></div>
                </div>
                <div class="line"></div>
                <div>これらの設定の変更は再起動後に適用されます。</div>
                <div class="listing" style="width: 100%; text-align: left; padding: 0px 10px;">
                    <div id="dummySettingJP"></div>
                </div>
            `, ['閉じる'], null, 'settingsList')

            betterJapanese.writeButton('openIgnoreWordList', null, '置き換え除外リスト', '非公式翻訳に置き換えたくない単語を指定することができます。', betterJapanese.openIgnorePrompt, 'dummyIgnoreListJP')
            betterJapanese.writeButton('toggleShowSpoilerAlertButton', 'showSpoilerAlert', '除外リスト表示確認', '除外リストを表示する際にネタバレに対する確認を表示します。', null, 'dummyIgnoreListJP')
            betterJapanese.writeButton('toggleReplaceBackgroundNameButton', 'replaceBackgroundName', '背景名', '背景の名前を翻訳します。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceMarketQuoteButton', 'replaceMarketQuote', '在庫市場のフレーバーテキスト', '在庫市場のフレーバーテキストを翻訳し、日本語で表示されるようにします。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceGardenImageButton', 'replaceGardenImage', '菜園情報の画像', '菜園情報内で表示される画像を日本語のものに置き換えます。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceUpdateLogButton', 'replaceUpdateLog', '情報欄及び更新履歴', '情報欄を詳しい内容に置き換え、更新履歴の日本語版を追加します。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceSpecialUpgradesButton', 'replaceSpecialUpgrades', '特殊なアップグレード', 'アップグレードに英語以外では存在しない特殊なフレーバーテキストや概要を追加します。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplacePurchasedTagButton', 'replacePurchasedTag', '特殊なタグ', '英語以外では変化しない特殊なタグを追加します。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceBuildingsButton', 'replaceBuildings', '施設固有の表現', '一部の説明欄において施設によって異なる表現を追加します。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleBeautifyAscendNumber', 'beautifyAscendNumber', 'ヘブンリーチップスの短縮表記', '画面右上および転生時のヘブンリーチップス入手数を短縮表記にし、改行しないようにします。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceCSSButton', 'replaceCSS', 'CSSの変更', 'フレーバーテキストの囲み文字をかぎ括弧に変更します。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceNewsButton', 'replaceNews', 'ニュース欄の改善', 'ニュース欄の挙動および翻訳を置き換えます。', null, 'dummySettingJP')
            betterJapanese.writeButton('toggleReplaceOthersButton', 'replaceOthers', 'そのほか微小な改善', 'ツールチップなどの翻訳を置き換えます。', null, 'dummySettingJP')
        }

        this.writeButton('toggleBJPButton', 'replaceJP', '日本語訳の改善', '公式の翻訳を非公式日本語訳に置き換えます。また、公式では翻訳されていない部分も翻訳されます。変更は再起動後に適用されます。')
        this.writeButton('openBJPSettingsButton', null, '翻訳詳細設定', '主にゲームの処理を変更する翻訳処理に関する設定を表示します。上記設定について項目別に切り替えられます。', openSettings)
        this.writeButton('toggleNumberJPButton', 'numberJP', '日本語単位', '数の単位に日本語単位を用います。', updateAll)
        this.writeButton('toggleShortFormatJPButton', 'shortFormatJP', '塵劫記単位', '数の単位に塵劫記の単位(阿僧祇～無量大数)を用います。', updateAll)
        this.writeButton('toggleSecondFormatJPButton', 'secondFormatJP', '第二単位', `${loc('ON')}の場合はXXXX億YYYY万、${loc('OFF')}の場合はXXXX.YYYY億のように表示されます。`, updateAll)
    },

    injectStats: function() {
        const strLegacyStarted = '<div class="listing"><b>' + loc('Legacy started:') + '</b>'
        l('menu').innerHTML = l('menu').innerHTML.replace(new RegExp(strLegacyStarted + ' (.+?), (.+?)</div>'), strLegacyStarted + ' $1、$2</div>')

        // 統計欄のデバッグ用アップグレードの見出しを翻訳
        if (!betterJapanese.origins.updateMenu) betterJapanese.origins.updateMenu = Game.UpdateMenu
        Game.UpdateMenu = function() {
            betterJapanese.origins.updateMenu()
            if (Game.onMenu == 'stats') {
                if (l('statsUpgrades').children[0].children[0].innerHTML == 'Debug') {
                    l('statsUpgrades').children[0].children[0].innerHTML = loc('Debug')
                }
            }
        }

        let target = l('statsGeneral')
        let div = document.createElement('div')
        div.innerHTML = `<b>日本語訳改善Mod:</b> ${betterJapanese.version}`
        div.className = 'listing'

        if (target) target.parentNode.appendChild(div)
    },

    writeButton: function(buttonId, targetProp = null, desc, label = null, callback = null, targetElementName = 'monospaceButton') {
        // 本家のWritePrefButtonとほぼ同じ

        // ボタンを追加する先の要素を指定 (デフォルトはmonospaceButton)
        let targetElement = l(targetElementName)

        // 仕様の都合上、最初に改行タグを追加
        targetElement.parentNode.insertBefore(document.createElement('br'), targetElement.previousElementSibling)

        // ボタンを生成
        let elementButton = document.createElement('a')
        elementButton.className = 'smallFancyButton option'
        if (targetProp) elementButton.className += ` prefButton ${this.config[targetProp] ? 'on' : 'off'}`
        elementButton.id = buttonId

        let onclickStr = targetProp ? `betterJapanese.toggleButton('${buttonId}', '${targetProp}', '${desc}');` : ''

        // Callbackが存在し、なおかつ与えられた引数がfunctionであればCallbackを追加
        if (callback && typeof callback === 'function') onclickStr += `(${callback.toString()})()`

        elementButton.setAttribute(Game.clickStr, onclickStr)

        elementButton.innerText = desc

        if (targetProp) elementButton.innerText += ` ${this.config[targetProp] ? loc('ON') : loc('OFF')}`

        targetElement.parentNode.insertBefore(elementButton, targetElement.previousElementSibling)

        // ラベルがあれば生成
        if (label) {
            let elementLabel = document.createElement('label')
            elementLabel.innerText = `(${label})`
            targetElement.parentNode.insertBefore(elementLabel, targetElement.previousElementSibling)
        }
    },

    toggleButton: function(buttonId, targetProp, desc) {
        let button = l(buttonId)
        betterJapanese.config[targetProp] = !betterJapanese.config[targetProp]
        button.className = `smallFancyButton prefButton option ${this.config[targetProp] ? 'on' : 'off'}`
        button.innerText = `${desc} ${this.config[targetProp] ? loc('ON') : loc('OFF')}`
        PlaySound('sounds/tick.mp3')
    },

    addDevButton: function() {
        let element = document.createElement('div')
        element.innerHTML = '<button style="position: absolute; left: 10px; top: 10px; z-index: 9999;" type="button" onclick="betterJapanese.reloadLanguagePack()">Reload LanguageFile</button>'
        document.body.append(element)
    },

    getJSON: async function(url) {
        let res = await fetch(url).then(res => res.json()).catch((err) => {
            this.log(`An error occurred while retrieving data: ${err}`)
            return null
        })

        if (!res) return null

        return res
    },

    getAssetsData: async function() {
        // キャッシュがあればキャッシュを返す
        if (this.api.cache) return this.api.cache

        // なければ取得して定義
        this.api.cache = await this.getJSON(this.api.url.release)
        this.api.endpoints.TRANSLATE = !this.isDev ? this.api.cache?.url?.translate : this.api.url.dev + '/translate.json'
        this.api.endpoints.CATEGORY = !this.isDev ? this.api.cache?.url?.category : this.api.url.dev + '/category.json'

        return this.api.cache
    },

    checkUpdate: async function(force = false) {
        this.log('Checking updates')

        // 開発者モードがONであれば強制的に更新
        if (this.isDev) return await this.updateLanguagePack()

        // APIからアセットのデータを取得
        let data = await this.getAssetsData()

        // データが正しく取得できなかったら終了
        if (!data) return this.log('An error occurred while checking updates')

        // 更新がなかったら終了
        if (data.hash === this.config.hash && !force) return this.log('No updates available')

        return await this.updateLanguagePack()
    },

    reload: function() {
        Game.toSave = true
        Game.toReload = true
    },

    reloadLanguagePack: async function() {
        await this.checkUpdate()
        ModLanguage('JA', JSON.parse(localStorage.getItem('BJPLangPack')))
    },

    updateLanguagePack: async function() {
        let assetsData = await this.getAssetsData()

        // assetsDataが存在せず、なおかつ開発者モードではなければ終了
        if (!assetsData && !this.isDev) return null

        let translateJson = await this.getJSON(this.api.endpoints.TRANSLATE)
        let ignoreList = this.config.ignoreList

        for (let key of ignoreList) {
            delete translateJson[key]
        }

        translateJson[''] = {
            'language': 'JA',
            'plural-forms': 'nplurals=2;plural=(n!=1);'
        }

        localStorage.setItem('BJPLangPack', JSON.stringify(translateJson))
        this.config.hash = assetsData.hash
        this.save()

        this.log('Update successfull')

        Game.Notify('日本語訳改善Mod', '翻訳データを更新しました。<br>再読み込み後から有効になります。<br><a onclick="betterJapanese.reload()">セーブデータを保存して再読み込み</a>')
    },

    openIgnorePrompt: async function(showSpoilerAlert = true) {
        let spoilerAlert = `
            <h3>ネタバレ注意</h3>
            <p>置き換え除外リストにはCookieClickerのネタバレが含まれている可能性があります。表示してもよろしいですか？</p>
        `

        if (showSpoilerAlert && betterJapanese.config.showSpoilerAlert) return Game.Prompt(spoilerAlert, [['開く', 'Game.ClosePrompt();betterJapanese.openIgnorePrompt(false);'], 'キャンセル'])

        betterJapanese.tmpIgnoreList = {}

        let content = `
            <h3>非公式日本語訳 置き換え除外リスト</h3>
            <div style="display: flex; height: 65vh;">
                <div style="display: flex; flex-direction:column; width: 50%; padding: 10px;">
                    <h4>カテゴリから選択</h4>
                    <p>カテゴリから一括して単語の置き換えの除外を設定することが出来ます。</p>
                    <div id="ignorelist-category" style="overflow-y: scroll; text-align: left;">読み込み中</div>
                </div>
                <div style="display: flex; flex-direction:column; width: 50%; padding: 10px;">
                    <h4>単語を個別に選択</h4>
                    <p>単語の左にあるチェックボックスにチェックを付けるとその単語の置き換えを無効化します。</p>
                    <div>
                        <input id="ignorelist-search" type="search" placeholder="単語を検索" onchange="betterJapanese.createIgnoreWordList()">
                        <button type="button" onclick="betterJapanese.changeAllIgnoreList(true)">全選択</button>
                        <button type="button" onclick="betterJapanese.changeAllIgnoreList(false)">全解除</button>
                    </div>
                    <div id="ignorelist-content" style="overflow-y: scroll; text-align: left;">読み込み中</div>
                </div>
            </div>
        `

        Game.Prompt(content, [['保存', 'betterJapanese.saveIgnoreList();Game.ClosePrompt();'], 'キャンセル'], null, 'ignoreList')

        document.getElementById('ignorelist-search').addEventListener('input', (e) => {
            document.getElementById('ignorelist-content').innerHTML = '検索中'
            betterJapanese.createIgnoreWordList()
        })
        document.getElementById('ignorelist-content').addEventListener('change', (e) => {
            if (!e.target.name || !e.target.name.startsWith('word:')) return
            let key = e.target.name.replace('word:', '').replace(/&quot;/g, '"')
            betterJapanese.tmpIgnoreList[key] = e.target.checked
            document.querySelectorAll(`[name$=${CSS.escape(e.target.name)}]`).forEach(element => {
                element.checked = e.target.checked
                if (element.name.indexOf('category:') === 0) betterJapanese.updateIgnoreCategoryList(element.name.replace('/' + e.target.name, ''))
            })
        })

        let checkButton = (obj, state, position) => {
            let element = document.getElementsByName(position)[0]
            element.checked = state
            if (state) element.indeterminate = false

            if (obj.constructor === Object) {
                Object.keys(obj).forEach(key => checkButton(obj[key], state, `${position}/${key}`))
                return
            }

            obj.forEach(key => {
                betterJapanese.tmpIgnoreList[key] = state
                document.querySelectorAll(`[name$=${CSS.escape('word:' + key.replace(/"/g, '&quot;'))}]`).forEach(e => e.checked = state)
            })
        }

        document.getElementById('ignorelist-category').addEventListener('change', (e) => {
            if (!e.target.name || !e.target.name.startsWith('category:')) return
            let category, word
            if ((word = e.target.name.match(/^(category:.+?)\/word:(.+)$/)) === null) {
                category = e.target.name.replace('category:', '').split('/')
                let currentPosition = betterJapanese.tmpCategoryList

                category.forEach(key => {
                    currentPosition = currentPosition[key]
                })

                checkButton(currentPosition, e.target.checked, e.target.name)
                betterJapanese.updateIgnoreCategoryList(category.slice(0, -1).join('/'))
            } else {
                checkButton([word[2].replace(/&quot;/g, '"')], e.target.checked, e.target.name)
                betterJapanese.updateIgnoreCategoryList(word[1])
            }
        })

        betterJapanese.createIgnoreWordList()
        betterJapanese.createIgnoreCategoryList()
    },

    createIgnoreWordList: async function() {
        let searchWord = document.getElementById('ignorelist-search')?.value || ''
        let translateList = await betterJapanese.getJSON(betterJapanese.api.endpoints.TRANSLATE)
        let ignoreList = betterJapanese.processIgnoreList()
        betterJapanese.currentIgnoreList = []

        const searchObject = (obj) => {
            if (obj.constructor === Object || obj.constructor === Array) {
                return Object.values(obj).some(v => searchObject(v))
            }
            return obj.match(searchWord)
        }

        let translateListHtml = []
        for (let key of Object.keys(translateList)) {
            let value = translateList[key]
            let isChecked = ignoreList.includes(key)

            if (searchWord && !searchObject(value)) continue

            betterJapanese.currentIgnoreList.push(key)

            translateListHtml.push(`
                <label>
                    <input type="checkbox" name="word:${key.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}>
                    <div>
                        ${((value.constructor === Object || value.constructor === Array) ? this.parseHTML(key) : '') + this.parseHTML(value)}
                    </div>
                </label>
                `)
        }

        if (!translateListHtml.length) translateListHtml.push('<p>該当する単語が見つかりませんでした。</p>')

        document.getElementById('ignorelist-content').innerHTML = `<ul class="accordion-words"><li>${translateListHtml.join('</li><li>')}</li></ul>`
    },

    parseHTML: function(object) {
        if (object.constructor === Object || object.constructor === Array) {
            return `<ul><li>${Object.values(object).map(v => this.parseHTML(v)).join('</li><li>')}</li></ul>`
        }
        return object.toString().replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '')
    },

    createIgnoreCategoryList: async function() {
        let categoryList = await betterJapanese.getJSON(betterJapanese.api.endpoints.CATEGORY)
        let translateList = await betterJapanese.getJSON(betterJapanese.api.endpoints.TRANSLATE)
        let ignoreList = betterJapanese.processIgnoreList()
        betterJapanese.tmpCategoryList = categoryList

        let categoryListHtml = '<ul>'

        let createNest = (category, parent) => {
            for (let key of Object.keys(category)) {
                let value = category[key]
                let current = parent ? `${parent}/${key}` : key
                let isExistChild = value.constructor === Object

                let id = `accordion:${current}`
                categoryListHtml += `
                    <input type="checkbox" id="${id}" class="accordion-parent">
                    <label for="${id}">
                        <li>
                            <label>
                                <input type="checkbox" name="category:${current}">${key}
                            </label>
                        </li>
                    </label>
                    <ul class="accordion-child${!isExistChild ? ' accordion-words' : ''}">
                `
                if (isExistChild) {
                    createNest(value, current)
                } else {
                    // 末端カテゴリの場合は属する翻訳文のツリー化
                    for (let wordKey of value) {
                        let wordValue = translateList[wordKey]
                        categoryListHtml += `<li><label><input type="checkbox" name="category:${current}/word:${wordKey.replace(/"/g, '&quot;')}"${ignoreList.includes(wordKey) ? ' checked' : ''}><div>`
                        if (wordValue.constructor === Object || wordValue.constructor === Array) {
                            categoryListHtml += this.parseHTML(wordKey)
                        }
                        categoryListHtml += this.parseHTML(wordValue) + '</div></label></li>'
                    }
                }
                categoryListHtml += '</ul>'
            }
        }

        createNest(categoryList)
        categoryListHtml += '</ul>'

        document.getElementById('ignorelist-category').innerHTML = categoryListHtml
        Object.keys(categoryList).forEach(k => betterJapanese.updateIgnoreCategoryList('category:' + k))
    },

    updateIgnoreCategoryList: function(position) {
        // A/B/Cを変更した場合はpositionはcategory:A/Bとして実行、A/B以上を更新する
        let numCategories = position.match(/\/[^\/]+/g)?.length ?? 0
        for (let i = 0; i <= numCategories; i++) {
            let elements = document.querySelectorAll(`[name^=${CSS.escape(position)}\\/]`)
            let parent = document.getElementsByName(position)[0]

            if (!elements || !parent) continue

            let checkState = 0
            let isContainIndeterminate = false

            elements.forEach(e => {
                if (e.indeterminate) isContainIndeterminate = true
                if (e.checked) checkState++
            })

            if (isContainIndeterminate) checkState = -1

            switch (checkState) {
                case 0: {
                    parent.indeterminate = false
                    parent.checked = false
                    break
                }

                case elements.length: {
                    parent.indeterminate = false
                    parent.checked = true
                    break
                }

                default: {
                    parent.indeterminate = true
                    parent.checked = false
                    break
                }
            }

            position = position.replace(/\/[^\/]+?$/, '')
        }
    },

    changeAllIgnoreList: function(state) {
        betterJapanese.currentIgnoreList.forEach(key => {
            betterJapanese.tmpIgnoreList[key] = state
        })
        betterJapanese.createIgnoreWordList()
    },

    processIgnoreList: function() {
        let array = betterJapanese.config.ignoreList.concat()

        for (let key of Object.keys(betterJapanese.tmpIgnoreList)) {
            // 変更予定リストに含まれている要素がtrueであればignoreListに追加
            if (betterJapanese.tmpIgnoreList[key]) {
                array.push(key)
                continue
            }

            // 変更予定リストに含まれている要素がfalseでなおかつignoreListに追加されていればignoreListから削除
            if (array.includes(key)) {
                array.splice(array.indexOf(key), 1)
            }
        }

        return array
    },

    saveIgnoreList: function() {
        betterJapanese.config.ignoreList = betterJapanese.processIgnoreList()
        betterJapanese.checkUpdate(true)
        // Game.Notify('日本語訳改善Mod', '置き換え除外リストを保存しました。<br>再読み込み後から有効になります。<br><a onclick="betterJapanese.reload()">セーブデータを保存して再読み込み</a>')
    },

    formatEveryFourthPower: function() {
        // 接尾辞挿入の4桁区切り版、secondで第二単位の使用を指定
        return function(value) {
            const prefixes = betterJapanese.config.shortFormatJP ? betterJapanese.formats.short : betterJapanese.formats.prefix
            const suffixes = betterJapanese.config.shortFormatJP ? [''] : betterJapanese.formats.suffixes

            // infinityの場合は無限大を返す
            if (!isFinite(value)) return '無限大'// loc("Infinity")

            // 表示可能な数値を上回った場合は標準の指数表記で出力
            if (value > 10 ** (prefixes.length * suffixes.length * 4)) return value.toPrecision(3).toString()

            // 小数点の場合は最大小数第3位まででそのまま出力
            if (value < 1) return (Math.round(value * 1000) / 1000).toString()

            const digitFloored = 10 ** Math.ceil(Math.log10(value) - 8)
            if (digitFloored > 1) value = Math.round(value / digitFloored) * digitFloored // 表示される上位8桁以下を切り捨て
            const numeral = Math.floor(Math.log10(value) / 4)
            const preIndex = numeral % prefixes.length
            const sufIndex = Math.floor(numeral / prefixes.length)
            const dispNum = Math.round(value * 10000 / (10 ** (numeral * 4)))

            // 第二単位を付ける
            if (betterJapanese.config.secondFormatJP) {
                if (!preIndex && !sufIndex) return value

                let str = Math.floor(dispNum / 10000) + (preIndex ? prefixes[preIndex] : suffixes[sufIndex])
                if (dispNum % 10000) str += (dispNum % 10000) + prefixes[preIndex ? preIndex - 1 : prefixes.length - 1]
                str += suffixes[preIndex ? sufIndex : sufIndex - 1]

                return str !== 'NaN' ? str : value.toPrecision(3).toString()
            }

            // 第二単位を付けない
            return Math.round(value * 10000 / (10 ** (numeral * 4))) / 10000 + prefixes[preIndex] + suffixes[sufIndex]
        }
    },

    createSynergyUpgradeDesc: function(upgrade) {
        return `${loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(upgrade.buildingTie1.plural), 5, upgrade.buildingTie2.single])}<br>${loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(upgrade.buildingTie2.plural), 0.1, upgrade.buildingTie1.single])}`
    },

    locTicker: function(tickerText) {
        let baseTickerText = tickerText
        let newsFormat = loc('News :').replace(' ', '&nbsp;')
        let newsRegex = new RegExp(`N.*ws : |${newsFormat} `)
        let isStartWithHtmlTag = tickerText.startsWith('<')
        let isContainsNewsText = tickerText.match(newsRegex)

        // "News : "があれば除去
        let ticker = isContainsNewsText ? tickerText.replace(newsRegex, '') : tickerText

        // htmlタグが含まれている場合はタグを除去
        if (isStartWithHtmlTag) ticker = ticker.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '')

        // 翻訳
        let localizedStr = betterJapanese.replaceString(ticker)

        // 先程削除したNewsを追加 (含んでいなければ何もしない)
        if (isContainsNewsText) localizedStr = `${newsFormat} ${localizedStr}`

        // htmlタグが含まれている場合はタグを追加
        if (isStartWithHtmlTag) localizedStr = baseTickerText.replace(ticker, localizedStr)

        return localizedStr
    },

    replaceString(str) {
        // locStringsから探して見つかれば返す
        let staticLocStr = locStrings[str]
        if (staticLocStr) return staticLocStr

        // 動的なニュース(Ticker (Dynamic))のリストが読み込めていなければそのまま返す
        let dynamicLocList = locStrings['Ticker (Dynamic)']
        if (!dynamicLocList) return str

        // 動的ニュースリストから対象のニュースを探す
        let targetStr = Object.keys(dynamicLocList).find((text) => {
            // エスケープが必要な文字をエスケープしてから動的な部分 (%1や%2など) を置き換え
            return betterJapanese.getReplacedRegex(text).test(str)
        })

        if (!targetStr) {
            betterJapanese.log(`翻訳が見つかりませんでした。\nString: ${str}`)
            return str
        }

        let dynamicLocStr = dynamicLocList[targetStr]

        // 置き換える単語を取得
        let strParams = betterJapanese.getReplacedRegex(targetStr).exec(str)

        // 置き換え
        for (let i = 0; i < strParams.length - 1; i++) {
            dynamicLocStr = dynamicLocStr.replace(`%${i + 1}`, betterJapanese.replaceString(strParams[i + 1]))
        }

        return dynamicLocStr
    },

    getReplacedRegex: function(str, splitRegex = /%\d+/g) {
        let regex = str.replace(/(\\|\*|\+|\.|\?|\{|\}|\(|\)|\^|\$|\|)/g, '\\$1')
        if (str.match('%1 %2')) regex = regex.replace('%1', '(.*?)')
        regex = regex.replace(splitRegex, '(.*)')

        return new RegExp(regex, 'g')
    },

    isAvailableMinigame: function(name) {
        return !!document.getElementById(`minigameScript-${Game.Objects[name].id}`)
    },

    devCheck: function(isDev = false) {
        if (betterJapanese.initialized) return

        betterJapanese.isDev = betterJapanese.isDev || isDev
        betterJapanese.checkUpdate()
        betterJapanese.log(`DevMode: ${betterJapanese.isDev}`)
        if (betterJapanese.isDev) betterJapanese.addDevButton()
        clearTimeout(betterJapanese.fallbackTimer)
        betterJapanese.initialized = true
    }
}

if (App) {
    window.api.receive('fromMain', (msg) => {
        if (msg.id === 'greenworks loaded') {
            betterJapanese.devCheck(!!msg.data.DEV)
        }
    })
} else {
    betterJapanese.devCheck(false)
}

// 言語設定が日本語であれば登録
if (localStorage.getItem('CookieClickerLang') === 'JA') {
    Game.registerMod(betterJapanese.name, betterJapanese)
    betterJapanese.overrideBeautify()
}
