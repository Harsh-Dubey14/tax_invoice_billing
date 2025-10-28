const cds = require('@sap/cds');
const cors = require('cors');

cds.on('bootstrap', app => {
  app.use(cors({
    origin: '*',
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
  }));
});

// no need to require service.js or getBillingDocument.js manually
module.exports = cds.server;
