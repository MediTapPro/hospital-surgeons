const fs = require('fs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const existingSpec = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/swagger.json'), 'utf8'));
const specification = swaggerJSDoc({
  definition: { ...existingSpec, paths: {} },
  apis: [path.join(process.cwd(), 'app/api/**/route.ts')],
});

fs.writeFileSync(path.join(process.cwd(), 'public/swagger.json'), `${JSON.stringify(specification, null, 2)}\n`);
