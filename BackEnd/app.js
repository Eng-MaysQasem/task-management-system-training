var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
require("./Modules/tickets/tickets.cleanup.job");


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(cors({
  origin: "http://localhost:5173",   
  credentials: true,                 
}));

const healthRouter = require('./Modules/health');
const authRouter = require('./Modules/auth/auth.routes');
const ticketsRouter = require('./Modules/tickets/tickets.route');
const sprintRouter = require('./Modules/sprints/sprints.route')
const userRouter = require('./Modules/user/user.routes');
const adminRouter = require("./Modules/user/admin.routes")
const reportRouter = require("./Modules/reports/reports.routes")


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const openapiPath = path.join(__dirname, 'openapi.yaml');
const openapiDoc = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));
app.get('/openapi.yaml', (req, res) => {
  res.sendFile(openapiPath);
});

app.use('', healthRouter);
app.use('/auth', authRouter);
app.use('/tickets', ticketsRouter);
app.use('/sprints', sprintRouter)
app.use('/profile', userRouter);
app.use('/admin', adminRouter)
app.use('/reports', reportRouter)





app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});


const errorHandler = require('./Modules/Middlewares/errorHandler');
app.use(errorHandler);

module.exports = app;
