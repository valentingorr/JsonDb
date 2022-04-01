# JsonDb

simple way to store json data localy for free.

## connection
```js
const JsonDb = require("../localjsondb/index.js");
const db = JsonDb.connectTo("myDb");
module.exports = db;
```
## insert items
```js
// insert one client in the table "clients"
db.table("clients").insert({
	firstname: "John",
	lastname: "Doe"
});

// insert multiple clients at once in the table "clients"
db.table("clients").insert([
	{
		firstname: "John",
		lastname: "Doe"
	},
	{
		firstname: "David",
		lastname: "Doe"
	},
]);
```

## select items
```js
// select items from table "clients"

// select all items
db.table("clients").select();

// select items with a condition
db.table("clients").select(item => item.firstname === "John");
```

## update items
```js
// update items from table "clients"

// select all items
db.table("clients").update(true, {
	firstname: "Johny"
});

// select items with a condition
db.table("clients").update(item => item.firstname === "John", {
	firstname: "Johny"
});
```

## delete items
```js
db.table("clients").delete(item => item.firstname === "John");
```

## clear database
```js
db.dumpAll();
```
