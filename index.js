const fs = require("fs");
const path = require("path");

const parseFileName = fileName => {
	[
		/[\\\/\:\*\?\"\'\`\<\>\|\;]/g,
		/^\./,
		/\..*$/
	].forEach(regex => {
		fileName = fileName.replace(regex, "");
	});
	return fileName;
};

const tableModel = tableName => {
	return {
		name: tableName,
		increment: 0,
		items: []
	}
};

const schemaModel = {
	alias: undefined,
	items: {}
};

const groupBy = (items, attribute, dbParameters) => {
	return new Select(items, { group: attribute }, dbParameters);
};

const join = (items, dispatcher, dbParameters, param1, param2, param3) => {
	const parameters = {
		table: undefined,
		as: undefined,
		join: (first, second) => true
	};

	[param1, param2, param3].forEach(param => {
		switch(typeof param) {
			case "string":
				if(!parameters.table) return parameters.table = param;
				parameters.as = param;
				break;
			case "function":
				parameters.join = param;
				break;
		}
	});
	const tables = dispatcher.tables;
	const table = tables.find(table => table.name === parameters.table);
	if(!table) throw new Error("non-existent table");	

	if(!parameters.as) {
		if(table.schema.alias) {
			parameters.as = table.schema.alias;
		} else {
			throw new Error("you must set the joined table alias");
		}
	};

	const joinedItems = {
		first: items,
		second: JSON.parse(fs.readFileSync(table.path, "utf-8")).items
	};
	const joined = joinedItems.first.map(first => {
		joinedItems.second.forEach(second => {
			if(parameters.join(first, second)) first[parameters.as] = second;
		});
		return first;
	});

	return new Select(joined, {}, dbParameters);
};

class Select {
	constructor(items, methodParameters, dbParameters) {
		this.items = items;
		this.methodParameters = methodParameters || {};
		this.dbParameters = dbParameters;
	}
	join(param1, param2, param3) {
		return join(this.items, this.dbParameters.dispatcher, this.dbParameters, param1, param2, param3);
	}
	groupBy(attribute) {
		return groupBy(this.items, attribute);
	}
	select(param1, param2) {
		const parameters = {
			condition: () => true,
			attributes: [],
			group: undefined,
			...this.methodParameters
		};

		[param1, param2].forEach(param => {
			if(!param) return;
			switch(typeof param) {
				case "object":
					if(!Array.isArray(param)) return;
					parameters["attributes"] = param.map(attribute => {
						if(Array.isArray(attribute)) return attribute;
						return [attribute, attribute];
					});
					break;
				default: case "function":
					parameters["condition"] = param;
					break;
			}
		});

		const getAttributes = itemsArray => {
			return itemsArray.map(item => {
				if(parameters.attributes.length === 0) return item;
				let object = {};
				for(let attribute in item) {
					const selectedAttribute = parameters.attributes.find(a => a[0].split(".")[0] === attribute);
					if(selectedAttribute) {
						let currentValue = item;
						for(let key of selectedAttribute[0].split(".")) {
							currentValue = currentValue[key];
						}
						object[selectedAttribute[1]] = currentValue;
					}
				}
				return object;
			});
		};

		if("group" in this.methodParameters) {
			const sections = this.items.filter(parameters.condition).reduce((current, accumulator) => {
				if(this.methodParameters.group in current) {
					const obj = {};
					obj[current[this.methodParameters.group]] = [current];
					current = obj;
				}
				if(!(accumulator[this.methodParameters.group] in current)) current[accumulator[this.methodParameters.group]] = [];
				current[accumulator[this.methodParameters.group]].push(accumulator);
				return current;
			});
			let obj = {};
			for(let key of Object.keys(sections)) {
				obj[key] = getAttributes(sections[key]);
			}
			return obj;
		}
		return getAttributes(this.items.filter(parameters.condition));
	}
}

module.exports = class {
	constructor(parameters) {
		this.parameters = {
			dir: path.resolve(__dirname, "databases/"),
			...parameters
		}
		if(!fs.existsSync(this.parameters.dir)) fs.mkdirSync(this.parameters.dir);
	}
	connectTo(parameters) {
		this.dbParameters = {
			constructor: this.parameters,
			charset: "utf-8"
		};
		switch (typeof parameters) {
			case "object":
				this.dbParameters = {
					...this.dbParameters,
					...parameters
				};
				break;
			default: case "string":
				this.dbParameters["dbname"] = parameters;
				break;
		}
		if(!"dbname" in this.dbParameters) throw new Error("you must define the database name");
		this.dbParameters.dir = path.resolve(this.dbParameters.constructor.dir, parseFileName(this.dbParameters.dbname));
		if(!fs.existsSync(this.dbParameters.dir)) fs.mkdirSync(this.dbParameters.dir);
		class DataBase {
			constructor(dbParameters) {
				this.dbParameters = dbParameters;
				this.dbParameters["path"] = path.resolve(this.dbParameters.dir, `_${parseFileName(this.dbParameters.dbname)}.json`);
				if(!fs.existsSync(this.dbParameters.path)) fs.writeFileSync(this.dbParameters.path, JSON.stringify({
					tables: []
				}));
				this._events = {};
				this.dbParameters.on = (tableName, event, callback) => {
					if(!(tableName in this._events)) this._events[tableName] = {
						"insert": [],
						"update": [],
						"delete": []
					};
					if(!(event in this._events[tableName])) throw new Error("event does not exist.");
					this._events[tableName][event].push(callback);
				};
				this.dbParameters.emit = (tableName, event, data) => {
					if(!(tableName in this._events)) return;
					this._events[tableName][event].forEach(callback => callback(data));
				};
			}
			get dispatcher() {
				return JSON.parse(fs.readFileSync(this.dbParameters.path, "utf-8"));
			}
			delete() {
				return fs.rmSync(this.dbParameters.dir, { recursive: true });
			}
			dumpAll() {
				this.dispatcher.tables.forEach(table => {
					const Table = this.table(table.name);
					Table.dump();
				})
			}
			table(tableName) {
				if(!tableName) throw new Error("you must define the table name");
				const tablePath = path.resolve(this.dbParameters.dir, parseFileName(tableName) + ".json");
				if(!fs.existsSync(tablePath)) fs.writeFileSync(tablePath, JSON.stringify(tableModel(tableName)));
				const dispatcher = this.dispatcher;
				if(!dispatcher.tables.find(t => t.name === tableName)) {
					dispatcher.tables.push({
						name: tableName,
						path: tablePath,
						schema: schemaModel
					});
					fs.writeFileSync(this.dbParameters.path, JSON.stringify(dispatcher));
				}
				this.dbParameters.dispatcher = this.dispatcher;
				const charset = this.dbParameters.charset;
				class Worker {
					set file(data) {
						return fs.writeFileSync(tablePath, JSON.stringify(data));
					}
					get json() {
						return JSON.parse(fs.readFileSync(tablePath), charset);
					}
				}

				class Table extends Worker {
					constructor(tablePath, dbParameters, tableName) {
						super();
						this.dbParameters = dbParameters;
						this.tableName = tableName;
						this.path = tablePath;
					}
					get tableSchema() {
						return this.dbParameters.dispatcher.tables.find(table => table.name === this.tableName).schema;
					}
					deleteSchema() {
						this.schema
					}
					schemaCheck(item, insert = true) {
						
						if(Object.keys(this.tableSchema.items).length === 0) return { status: true };

						if(insert) {
							if(!Object.keys(this.tableSchema.items).map(key => {
								if(!("required" in this.tableSchema.items[key]) || !this.tableSchema.items[key].required) return true;
								return (key in item);
							}).reduce((current, accumulator) => current && accumulator)) return { status: false, message: "missing table schema attribute" };
						}
						
						if(!Object.keys(item).map(key => {
							if(
								!this.tableSchema.items[key] ||
								!("type" in this.tableSchema.items[key])
							) return true;
							let type = typeof item[key];
							if(type === "object") type = Array.isArray(item[key]) ? "array" : "list";
							if(type === "string" && this.tableSchema.items[key].type === "number" || this.tableSchema.items[key].type === "float" && Number(item[key])) {
								type = "number";
								item[key] = Number(item[key]);
							}
							if(type === "number" && Number(item[key]) && Number(item[key]) % 1 === 0) type = "int";
							if(type === "number" && this.tableSchema.items[key].type === "float" && Number(item[key])) {
								type = "float";
								item[key] = Number(item[key]);
							}
							if(type === "number" && this.tableSchema.items[key].type === "string") {
								type = "string";
								item[key] = item[key].toString();
							}
							return type === this.tableSchema.items[key].type;
						}).reduce((current, accumulator) => current && accumulator)) return { status: false, message: "item attributes do not match table schema" };
						return { status: true };
					}
					set schema(schema) {
						const types = [
							"null", "undefined", "boolean", "int", "string", "list", "array", "float", "number"
						];
						for(let attribute in schema.items) {
							if("type" in schema.items[attribute] && !types.find(type => type === schema.items[attribute].type)) throw new Error("unknown value type");
						}
						const json = this.dbParameters.dispatcher;
						json.tables.find(table => table.name === this.tableName).schema = schema;
						fs.writeFileSync(this.dbParameters.path, JSON.stringify(json));
					}
					on(event, callback) {
						this.dbParameters.on(this.tableName, event, callback);
					}
					emit(event, data) {
						this.dbParameters.emit(this.tableName, event, data);
					}
					dump() {
						this.file = tableModel(this.tableName);
					}
					delete() {
						fs.unlinkSync(this.path);
					}
					deleteSchema() {
						const json = this.dbParameters.dispatcher;
						json.tables.find(table => table.name === this.tableName).schema = schemaModel;
						fs.writeFileSync(this.dbParameters.path, JSON.stringify(json));
					}
					insert(content, callback) {
						if(!content) return;
						const json = this.json;
						let callbackItems;
						const insertOne = item => {
							const schemaCheck = this.schemaCheck(item);
							if(!schemaCheck.status) {
								console.log("\x1b[31m", "JsonDb Warn (insert)", "\x1b[37m", schemaCheck.message, item);
								return undefined;
							}
							const defaultItem = {};
							for(let attribute in this.tableSchema.items) {
								if("default" in this.tableSchema.items[attribute]) defaultItem[attribute] = this.tableSchema.items[attribute].default;
							}
							json.increment++;
							const newItem = {
								...defaultItem,
								...item,
								_id: json.increment
							};
							json.items.push(newItem);
							this.emit("insert", newItem);
							return newItem;
						};
						if(Array.isArray(content)) {
							callbackItems = [];
							content.forEach(item => {
								callbackItems.push(insertOne(item))
							});
						} else {
							callbackItems = insertOne(content);
						}
						this.file = json;
						if(callback) return callback(callbackItems);
						return callbackItems;
					}
					update(param1, param2, param3) {
						const parameters = {
							condition: undefined,
							update: {},
							callback: undefined
						};
						[param1, param2].forEach(param => {
							if(!param) return;
							switch(typeof param) {
								case "object":
									parameters["update"] = param;
									break;
								default: case "function":
									if(!parameters.condition) return parameters["condition"] = param;
									parameters["callback"] = param;
									break;
							}
						});

						if(!parameters.condition) parameters.condition = () => true;

						for(let attribute in parameters.update) {
							if(/^\_/.test(attribute)) {
								delete parameters.update[attribute];
								console.log("\x1b[31m", "JsonDb Warn", "\x1b[37m", `can't update attribute "${attribute}"`);
							}
						}

						const schemaCheck = this.schemaCheck(parameters.update, false);
						if(!schemaCheck.status) {
							console.log("\x1b[31m", "JsonDb Warn (update)", "\x1b[37m", schemaCheck.message, parameters.update);
							return undefined;
						}

						const json = this.json;
						json.items = json.items.map(item => {
							if(!parameters.condition(item)) return item;
							this.emit("update", {
								from: item,
								to: {
									...item,
									...parameters.update
								}
							})
							return {
								...item,
								...parameters.update
							};
						});
						this.file = json;
					}
					remove(condition = () => false) {
						const json = this.json;
						json.items = json.items.map(item => {
							if(!condition(item)) return item;
							this.emit("delete", item);
							return false;
						}).filter(item => item);
						this.file = json;
					}
					select(param1, param2) {
						const select = new Select(this.json.items);
						return select.select(param1, param2);
					}
					groupBy(attribute) {
						return groupBy(this.json.items, attribute, this.dbParameters);
					}
					join(param1, param2, param3) {
						return join(this.json.items, this.dbParameters.dispatcher, this.dbParameters, param1, param2, param3);
					}
				}
				return new Table(tablePath, this.dbParameters, tableName);
			}
		}
		return new DataBase(this.dbParameters);
	}
};
