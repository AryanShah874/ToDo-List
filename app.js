
require('dotenv').config(); //always at the top
const express=require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");
const mongoose=require("mongoose");
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const date=require(__dirname+"/date.js");
const favicon=require("serve-favicon");
const path=require("path");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate=require("mongoose-findorcreate");
const { profile } = require('console');

const app=express();
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("strictQuery", true);
mongoose.connect("mongodb+srv://admin-aryan:"+process.env.PASSWORD+"@cluster0.pj3xbtk.mongodb.net/listDB");

const userSchema=new mongoose.Schema({
    username: String, 
    password: String, 
    googleId: String,
    items: {
        uncheckedItems: [],
        checkedItems: []
    }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User=new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
});  
passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/ToDo-List"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
});

app.get("/list", function(req, res){
    res.set("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

    const day=date.getDate();
    if(req.isAuthenticated()){
        User.findById(req.user.id, function(err, foundUser){
            if(err){
                console.log(err);
            }
            else{
                if(foundUser){
                    res.render("list", {listTitle: day, items: foundUser.items});
                }
            }
        });
    }
    else{
        res.redirect("/login");
    }
});

app.get("/register", function(req, res){
    let errorMsg=req.session.valid;
    req.session.valid=false;
    res.render("register", {error: errorMsg});
});

app.get("/login", function(req, res){
    let errorMsg=req.session.messages;
    req.session.messages=false;
    res.render("login", {error: errorMsg});
});

app.get("/logout", function(req, res){
    req.logout(function(err){
        if(err){
            console.log(err);
        }
        else{
            res.redirect("/");
        }
    });
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/ToDo-List', passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
    res.redirect('/list');
  });

app.post("/register", function(req, res){
    const newUser=new User({
        username: req.body.username
    });
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.session.valid=err.message;
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/list");
            });
        }
    });
});

app.post("/login", passport.authenticate("local", {failureRedirect: "/login", failureMessage: true}), function(req, res){
    res.redirect("/list");
});

app.post("/list", function(req, res){
    const item=req.body.item;

    User.findById(req.user.id, function(err, foundUser){
        if(err){
            console.log(err);
        }
        else{
            if(foundUser){
                foundUser.items.uncheckedItems.push(item);
                foundUser.save(function(){
                    res.redirect("list");
                });
            }
        }
    });
});

app.post("/checked", function(req, res){
    const index=req.body.itemIndex;

    User.findById(req.user.id, function(err, foundUser){
        if(err){
            console.log(err);
        }
        else{
            if(foundUser){
                foundUser.items.checkedItems.push(foundUser.items.uncheckedItems[index]);
                foundUser.items.uncheckedItems.splice(index, 1);
                foundUser.save(function(){
                    res.redirect("/list");
                });
            }
        }
    });
});

app.post("/delete", function(req, res){
    const index=req.body.itemIndex;

    User.findById(req.user.id, function(err, foundUser){
        if(err){
            console.log(err);
        }
        else{
            if(foundUser){
                foundUser.items.checkedItems.splice(index, 1);
                foundUser.save(function(){
                    res.redirect("/list");
                });
            }
        }
    });    
});

app.listen(3000, function(){
    console.log("Server started on port 3000");
});

