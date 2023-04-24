const passport= require('passport');
const FacebookStrategy= require('passport-facebook').Strategy;
const User=require('../models/user');
const keys= require('../config/keys');

passport.serializeUser((user,done)=>{
    done(null,user.id);
});
passport.deserializeUser((id,done)=>{
    User.findById(id,(err,user)=>{
        done(err,user);
    });
});
passport.use(new FacebookStrategy({
    clientID: keys.FacebookAppID,
    clientSecret: keys.FacebookAppSecret,
    callbackUrl: 'http://localhost:9000/auth/facebook/callback',
    profileFields : ['emails','displayName','name','photos']
},(accessToken,refreshToken,profile,done)=>{
    console.log("reached");
    console.log(profile);

}));