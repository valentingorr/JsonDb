const fs = require("fs");
const path = require("path");

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
		class Database {
			constructor() {
				this.events = new class {
					constructor() {
						this.tables = {};
					}
					on(tableName, eventName, eventCallback) {
						if(!this.tables[tableName]) this.tables[tableName] = {
							events: []
						};
						this.tables[tableName].events.push({
							name: eventName,
							callback: eventCallback
						});
					}
					emit(tableName, eventName, data) {
						if(!this.tables[tableName]) return;
						const event = this.tables[tableName].events.find(e => e.name === eventName);
						if(event) event.callback(data);
					}
				}
				this.parameters = parameters;
				this.parameters.file = path.join(this.parameters.dir, this.parameters.dbname + ".json");
				if(!fs.existsSync(this.parameters.dir))  fs.mkdirSync(this.parameters.dir);
				if(!fs.existsSync(this.parameters.file)) fs.writeFileSync(this.parameters.file, JSON.stringify({
					dbName: this.parameters.dbname,
					tables: []
				}));
			}
			get database() {
				return JSON.parse(fs.readFileSync(this.parameters.file));
			}
			dumpAll() {
				fs.writeFileSync(this.parameters.file, JSON.stringify({
					dbName: this.parameters.dbname,
					tables: []
				}));
			}
			tables() {
				return this.database.tables.map(table => table.tableName);
			}
			table(tableName) {
				class Table {
					constructor(parameters, events) {
						this.events = events;
						this.parameters = parameters;
						const data = this.database;
						if(!data.tables.find(t => t.tableName === this.parameters.tableName)) {
							data.tables.push({
								tableName: this.parameters.tableName,
								increment: 0,
								items: []
							});
							this.data = data;
						}
					}
					on(eventName, eventCallback) {
						this.events.on(this.parameters.tableName, eventName, eventCallback);
					}
					emit(eventName, data) {
						this.events.emit(this.parameters.tableName, eventName, data);
					}
					set data(data) {
						fs.writeFileSync(this.parameters.file, JSON.stringify(data));
					}
					get database() {
						return JSON.parse(fs.readFileSync(this.parameters.file));
					}
					get items() {
						return this.database.tables.find(t => t.tableName === this.parameters.tableName).items;
					}
					select(condition = item => true) {
						return this.items.filter(condition);
					}
					insert(content, callback = null) {
						const insertItem = item => {
							const data = this.database;
							const table = data.tables.find(t => t.tableName === this.parameters.tableName);
							table.increment++;
							table.items.push({
								...item,
								_id: table.increment
							});
							this.data = data;
							const newItem = this.select(item => item._id === table.increment)[0];
							this.emit("insert", newItem);
						}
						let result;
						if(Array.isArray(content)) {
							content.forEach(item => insertItem(item));
							const increment = this.database.tables.find(t => t.tableName === this.parameters.tableName).increment;
							result = [];
							console.log(increment, content.length)
							for(let i = increment; i !== content.length; i--) {
								console.log("id: ", i);
							}
						} else if(typeof content === "object") {
							insertItem(content);
						}
						if(!callback) return result;
						callback(result);
					}
					delete(condition = null) {
						if(!condition) return;
						const data = this.database;
						const table = data.tables.find(t => t.tableName === this.parameters.tableName);
						table.items.filter(condition).forEach(item => {
							this.emit("delete", item);
							table.items.splice(table.items.indexOf(item), 1);
						});
						this.data = data;
					}
					dump() {
						const data = this.database;
						const table = data.tables.find(t => t.tableName === this.parameters.tableName);
						table.items = [];
						this.data = data;
						this.emit("dump");
					}
				};
				return new Table({
					tableName: tableName,
					...parameters
				}, this.events);
			}
		}
		switch(typeof connexion) {
			case "string":
				parameters.dbname = connexion;
				break;
			 case "object":
				 parameters = {...parameters, ...connexion};
				 break;
		} return new Database(parameters);
	}
}

module.exports = JsonDb;
//test