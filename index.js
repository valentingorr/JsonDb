const fs = require("fs");
const path = require("path");
 
class Events {
  constructor() {
    this._events = [];
  }
  on(eventName, eventCallback) {
    this._events.push({
      name: eventName,
      callback: eventCallback
    });
  }
  emit(eventName, receive) {
    const event = this.events.find(e => e.name === eventName);
    if(event) event.callback(receive);
  }
}
 
class JsonDb {
  constructor(custom = {}) {
    let parameters = {
      dir: path.join(__dirname, "tables/")
    };
    this.parameters = {...parameters, ...custom};
  }
  connectTo(connexion) {
    let parameters = {
      dbname: undefined,
      charset: "utf-8",
      ...this.parameters
    };
    class Database extends Events {
      constructor() {
        super();
        this.parameters = parameters;
        this.parameters.file = path.join(this.parameters.dir, this.parameters.dbname + ".json");
        if(!fs.existsSync(this.parameters.dir))  fs.mkdirSync(this.parameters.dir);
        if(!fs.existsSync(this.parameters.file)) fs.writeFileSync(this.parameters.file, JSON.stringify({
          dbName: this.parameters.dbname,
          tables: []
        }));
      }
      table(tableName) {
        class Table extends Events {
          constructor(parameters) {
            super();
            this.parameters = parameters;
            const data = JSON.parse(fs.readFileSync(this.parameters.file));
            if(!data.tables.find(t => t.tableName === this.parameters.tableName)) {
              data.tables.push({
                tableName: this.parameters.tableName,
                increment: 0,
                items: []
              });
              fs.writeFileSync(this.parameters.file, JSON.stringify(data));
            }
          }
          get table() {
             return JSON.parse(fs.readFileSync(this.parameters.file)).tables.find(({tableName}) => tableName === this.parameters.tableName);
          }
          get items() {
            return this.table.items;
          }
          insert(item) {
            // fs.writeFileSync(this.parameters.file, JSON.stringify(data));
          }
        };
        return new Table({
          tableName: tableName,
          ...parameters
        });
      }
    }
    switch(typeof connexion) {
      case "string":
        parameters.dbname = connexion;
        break;
       case "object":
         parameters = {...parameters, ...connexion};
         break;
    }
    return new Database(parameters);
  }
}
 
const db = new JsonDb().connectTo("myDb");
console.log(db.table("clients").items)
db.table("clients").insert({
  "data": "value"
})
console.log(db.table("clients").items)
