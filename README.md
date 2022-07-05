# JsonDb

simple way to store json data localy for free.

```bach
git clone https://github.com/valentingorr/JsonDb
```

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
//quick connect
const db = JsonDb.connectTo("mydbname");

//or
const db = JsonDb.connectTo({
  dbname: "mydbname",
  charset: "utf-8"
});

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

//select attributes
db.table("clients").select(["firstName"]);

//as well
db.table("clients").select(["lastName"], item => item.firstname === "John");
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
db.table("clients").remove(item => item.firstname === "John");
```
### callback
```js
//insert
db.table("clients").insert({
  firstname: "John",
  lastname: "Doe"
}, newItem => {
  console.log(newItem); //retuns single item
});

db.table("clients").insert([
  {
    firstname: "John",
    lastname: "Doe"
  },
  {
    firstname: "David",
    lastname: "Doe"
  },
], newItems => {
  console.log(newItems); //retuns array of items
});

//or

const newItem = db.table("clients").insert({
  firstname: "John",
  lastname: "Doe"
}); //retuns single item

const newItems = db.table("clients").insert([
  {
    firstname: "John",
    lastname: "Doe"
  },
  {
    firstname: "David",
    lastname: "Doe"
  },
]); //retuns array of items

//remove
db.table("clients").remove(item => item.firstname === "John", deletedItems => {
  console.log(deletedItems); //retuns array of items
});

//or

const deletedItems = db.table("clients").remove(item => item.firstname === "John"); //retuns array of items
```

## group result by attribute value
```js
db.table("clients").groupBy("company").select();
```

## join multiple tables
```js
db.table("employees").insert([
  {
    name: "John Doe",
    company: 1
  },
  {
    name: "Charles Roberts",
    company: 2
  }
]);

db.table("companies").insert([
  { name: "Front-End & Co" },
  { name: "Back-End & Co" }
]);

const tableName = "companies";
const alias = "company"; // not mandatory if already defined in the table schema

const employees = db.table("employees").join(tableName, alias, (current, accumulator) => current.company === accumulator._id).select(["name", ["company.name", "company"]]);
console.log(employees);
//
// returns:
//  [
//      { name: 'John Doe', company: 'Front-End & Co' },
//      { name: 'Charles Roberts', company: 'Back-End & Co' }
//  ]
//
```

## add events to tables
```js
db.table("clients").on("insert", newItem => {
  console.log(newItem); //returns single item
});

db.table("clients").insert({
  firstName: "John",
  lastName: "Doe"
});

db.table("clients").on("update", changes => {
  console.log(changes); //returns changes of single item {from: .., to: ..}
});

db.table("clients").update(item => item._id === 1, {
  firstName: "David",
  lastName: "Doe"
});

db.table("clients").on("delete", items => {
  console.log(items); //returns single item
});

db.table("clients").remove(item => item._id === 2);
```

## clear database
```js
db.dumpAll();
```

## db methods
```js
.dumpAll() //dump each database tables
.delete() //delete database
.dispatcher //get the database dispatcher
```

## table methods
```js
.dump() //dump table
.delete() //delete table
.json //get file content in JSON format
.tableSchema //get schema of the table
.deleteSchema() //delete schema of the table
```

## optional schema (recommended)
```js
// set table schema
db.table("clients").schema = {
  alias: "client"
  items: {
    firstname: {
      type: "string",
      required: true
    },
    lastname: {
      type: "string",
      required: true
    },
    company: {
      type: "number",
      default: 1
    }
  }
};

// delete table schema
db.table("clients").deleteSchema();
```

### schema types
```
null undefined boolean number string list array int float
```
