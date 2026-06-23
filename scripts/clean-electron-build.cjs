#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

fs.rmSync(path.resolve(__dirname, '..', 'dist-electron'), {
  force: true,
  recursive: true,
});
