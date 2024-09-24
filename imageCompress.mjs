import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const imageDir = './img'
const outputDir = './src/images'
const extensionOptions = {
	jpg: {
		encoder: 'webp',
		quality: 50,
		effort: 5
	},
	png: {
		encoder: 'avif',
		quality: 50,
		effort: 6
	},
	gif: {
		encoder: 'gif',
		effort: 8
	},
}

const imageFiles = fs.readdirSync(imageDir).filter((file) => {
	return Object.keys(extensionOptions).includes(file.split('.').at(-1))
})

if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir)
}

await Promise.all(
	imageFiles.map(async (file) => {
		const encodeOption = extensionOptions[file.split('.').at(-1)]

		await sharp(path.join(imageDir, file))
			.toFormat(encodeOption.encoder, encodeOption)
			.toFile(path.join(outputDir, file))
	})
)
