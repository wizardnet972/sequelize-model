const Sequelize = require('sequelize');
const { camelCase, upperFirst, groupBy } = require('lodash');
const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');

dotenv.config({ path: '.env' });


const { DATABASE_CATALOG, DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST } = process.env;

const sequelize = new Sequelize(DATABASE_CATALOG, DATABASE_USER, DATABASE_PASSWORD, {
  host: DATABASE_HOST,
  dialect: 'mssql'
});

const types = {
  int: 'Sequelize.INTEGER'
};

(async () => {
  await sequelize.authenticate();

  const queryAllTables = `
    select * from INFORMATION_SCHEMA.COLUMNS as COLUMNS
    inner join INFORMATION_SCHEMA.TABLES as TABLES on TABLES.TABLE_NAME = COLUMNS.TABLE_NAME
  `;

  const allTables = await sequelize.query(queryAllTables, { type: sequelize.QueryTypes.SELECT });

  const baseTables = allTables.filter(t => t.TABLE_TYPE === 'BASE TABLE');

  const tables = groupBy(baseTables, 'TABLE_NAME');

  const f = Object.keys(tables).forEach(t => {
    const rows = tables[t];

    const columns = rows
      .map(r => {
        const prop = `
        @Column({ field: '${r.COLUMN_NAME}', type: ${types[r.DATA_TYPE]} })
        public ${r.COLUMN_NAME};
      `;

        // @PrimaryKey
        return prop;
      })
      .join('');

    const table = rows[0];
    const schema = table.TABLE_SCHEMA;
    const tableName = table.TABLE_NAME;
    const className = upperFirst(camelCase(table.TABLE_NAME));

    const content = `
      import { Table, Model, Column, PrimaryKey, HasMany } from 'sequelize-typescript';
      import Sequelize from 'sequelize';
      
      @Table({
        timestamps: false,
        schema: '${schema}',
        tableName: '${tableName}'
      })
      export class ${className}Model extends Model<${className}Model> {
        ${columns}
      }
    `;

    fs.writeFileSync(path.resolve(__dirname, 'models', `${className}.ts`), content);

    return content;
  });

  console.log({ f });
})();
