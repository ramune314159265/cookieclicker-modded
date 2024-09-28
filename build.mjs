import fs from 'fs-extra'

const copyTargets = ['index.html', 'style.css', 'grab.json', 'sw.js', 'manifest.json', 'images/', 'sounds/', 'js/']

console.time('build')

copyTargets.forEach(name => {
	fs.copySync(`./src/${name}`, `./build/${name}`)
})

console.timeEnd('build')
