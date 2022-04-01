# JsonDb

simple way to store json data localy for free.

## init
```js
const JsonDataBase = require("./JsonDb/index.js");
const JsonDb = new JsonDataBase();

//set custom folder
const JsonDb = new JsonDataBase({
    dir: "./myDatabases/"
});
```

## connect to db
```js
const db = JsonDb.connectTo("mydbname");
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

## add events to tables
```js
db.table("clients").on("insert", newItem => {
  console.log(newItem);
});

db.table("clients").insert({
  firstName: "John",
  lastName: "Doe"
});

db.table("clients").on("update", changes => {
  console.log(changes);
});

db.table("clients").update(item => item._id === 1, {
  firstName: "David",
  lastName: "Doe"
});

db.table("clients").on("delete", items => {
  console.log(items);
});

db.table("clients").delete(item => item._id === 2);
```

## clear database
```js
db.dumpAll();
```
