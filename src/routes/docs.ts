import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const openApiPath = path.join(__dirname, '..', '..', 'openapi', 'openapi.yaml')
const openApiDocument = YAML.parse(fs.readFileSync(openApiPath, 'utf8'))

export const docsRouter = Router()

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument)
})

docsRouter.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml').send(fs.readFileSync(openApiPath, 'utf8'))
})

docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  customSiteTitle: 'Apex Inventory API Docs',
}))
