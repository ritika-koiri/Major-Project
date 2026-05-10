if(process.env.NODE_ENV != "production"){
    require('dotenv').config();
}

const dns = require("dns");              
dns.setServers(["8.8.8.8", "1.1.1.1"]); 

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport")
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

const dbUrl = process.env.ATLASDB_URL; 

main();

async function main(){
    try {
        await mongoose.connect(dbUrl, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
             family: 4,
        });
        console.log(" Connected to DB");
        console.log("Mongoose state:", mongoose.connection.readyState);
    } catch (err) {
        console.log(" DB Connection Error:", err);
    }
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));


const store = MongoStore.create({
    mongoUrl: dbUrl,
    collectionName: "sessions",
    ttl: 14 * 24 * 60 * 60,
});

store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = { 
    store: store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user || null;
    next();
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);

app.get("/", (req, res) => {
  res.redirect("/listings"); 
})

app.use("/", userRouter);

app.all("/*splat", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"))
})

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("error.ejs", { 
        message, 
        success: res.locals.success || [], 
        error: res.locals.error || [],
        currUser: res.locals.currUser || null
    });
});

app.listen(8080, () => {
    console.log("server is listening to port 8080");
});
