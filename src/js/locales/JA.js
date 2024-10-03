LoadLang(`./js/locales/JA_fallback.js`)

let conf = JSON.parse(localStorage.getItem('BJPConfig') || '{"replaceJP": false}')
let language = localStorage.getItem('BJPLangPack')

if (language && conf.replaceJP) {
	locId = 'JA'
	ModLanguage('JA', JSON.parse(language))
}

Game.LoadMod(`./js/addons/japanese.js`)
