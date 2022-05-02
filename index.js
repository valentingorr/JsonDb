const fs = require("fs");
const path = require("path");
 
module.exports = class {
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
						this.joins = [];
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
						let items = this.database.tables.find(t => t.tableName === this.parameters.tableName).items;
						if(this.joins[0]) {
							for(let join of this.joins) {
								const joinedItems = this.database.tables.find(t => t.tableName === join.tableName).items;
								items = items.map(item => {
									let joined = {};
									for(let joinedItem of joinedItems) {
										if(join.joinParameters(item, joinedItem)) joined = joinedItem;
									}
									if(join.alias) {
										let object = {
											...item
										}
										object[join.alias] = joined;
										return object;
									} return {
										...joined,
										...item
									}
								});
							}
						}
						return items;

					}
					select(arg1, arg2) {
						const parameters = {
							condition: () => true,
							map: false
						};
						[arg1, arg2].filter(arg => arg ? true : false).forEach(arg => {
							switch (typeof arg) {
								case "function":
									parameters.condition = arg;
									break;
								case "object":
									if(!Array.isArray(arg)) break;
									parameters.map = arg;
									break;
							}
						});
						if(!parameters.map) return this.items.filter(parameters.condition);
						return this.items.filter(parameters.condition).map(item => {
							const object = {};
							parameters.map.forEach(marker => {
								const getValueFromAttributeString = string => {
									let data = item;
									let value;
									let attribute;
									string.split(".").forEach(attr => {
										value = data[attr];
										attribute = attr;
										data = data[attr];
									});
									return {
										value: value,
										attribute: attribute
									};
								};
								switch (typeof marker) {
									case "string":
										const value = getValueFromAttributeString(marker);
										object[value.attribute] = value.value;
										break;
									case "object":
										if(!Array.isArray(marker)) break;
										object[marker[1]] = getValueFromAttributeString(marker[0]).value;
										break;
								}
							});
							return object;
						});
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
							for(let i = increment; i !== (increment- content.length); i--) {
								result.push(this.select(item => item._id === i))[0];
							}
						} else if(typeof content === "object") {
							insertItem(content);
							const increment = this.database.tables.find(t => t.tableName === this.parameters.tableName).increment;
							result = this.select(item => item._id === increment)[0];
						   
						}
						if(!callback) return result;
						callback(result);
					}
					update(condition, replace) {
						if(condition === true) condition = item => true;
						const changes = [];
						const data = this.database;
						const table = data.tables.find(t => t.tableName === this.parameters.tableName);
						table.items.filter(condition).forEach(item => {
							const final = {
								...item,
								...replace
							};
							table.items[table.items.indexOf(item)] = final;
							changes.push({
								"from": item,
								"to": final
							});
						});
						this.data = data;
						this.emit("update", changes)
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
					join(arg1, arg2, arg3) {
						const parameters = {
							tableName: undefined,
							alias: undefined,
							joinParameters: () => {}
						};
						[arg1, arg2, arg3].filter(arg => arg ? true : false).forEach(arg => {
							switch (typeof arg) {
								case "string":
									if(!parameters.tableName) {
										parameters.tableName = arg;
										break;
									}
									parameters.alias = arg;
									break;
								case "function":
									parameters.joinParameters = arg;
									break;
							}
						});
						this.joins.push(parameters);
						return this;
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