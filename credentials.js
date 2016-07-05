const APP_CLIENT_ID = process.env.APP_CLIENT_ID || "";
const DATABASE_URL = process.env.DATABASE_URL||
"postgres:postgres:postgres@localhost:5432/slowNotStupid";
const PORT = process.env.PORT || 3000;

exports.APP_CLIENT_ID = APP_CLIENT_ID;
exports.DATABASE_URL = DATABASE_URL;
exports.PORT = PORT;
