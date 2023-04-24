// let's start!!!! yoo
const express= require('express');
const exphbs= require('express-handlebars');
const Handlebars= require('handlebars');
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access')
const bodyParser= require('body-parser')
const mongoose= require('mongoose');
const passport= require('passport');
const cookieParser= require('cookie-parser');
const session= require('express-session');
const flash= require('connect-flash');
const bcrypt= require('bcryptjs');
const formidable= require('formidable');
// load models
const Message= require('./models/message');
const User= require('./models/user');
const Chat= require('./models/chat');
const Smile= require('./models/smile');
const Post= require('./models/post');
const app = express();
// load keys file
const Keys= require('./config/keys');
// load helpers
const {requireLogin,ensureGuest} = require('./helpers/auth');
const {getLastMoment} = require('./helpers/moment');
const {walletChecker}= require('./helpers/wallet');
const chat = require('./models/chat');
const {uploadImage}= require('./helpers/aws');
// using body parser middleware
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
//configure
app.use(cookieParser());
app.use(session({
    secret:'mysecret',
    resave:true,
    saveUninitialized:true
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use((req,res,next)=>{
    res.locals.success_msg= req.flash('sucess_msg');
    res.locals.error_msg= req.flash('error_msg');
    // req.locals.error = req.flash('error');
    next();
});

// setup static folder for css,js and images
app.use(express.static('public'));
// defining user as a global object
app.use((req,res,next)=>{
    res.locals.user= req.user || null;
    next();
});
// facebook strategy
require('./passport/facebook');
require('./passport/google');
require('./passport/local');
// connect
mongoose.connect(Keys.MongoDB).then(()=>{
    console.log('server is connected to database');
}).catch((err)=>{
    console.log(err);
})
// setup view engine
app.engine('handlebars',exphbs({defaultLayout:'main', handlebars: allowInsecurePrototypeAccess(Handlebars),
  helpers: {
      getLastMoment : getLastMoment
  }
}));
app.set('view engine','handlebars');
// env variable
const PORT= process.env.PORT||9000;
// app.use('json');
app.get('/',ensureGuest,(req,res)=>{
    res.render('home',{
        title: 'Home'
    });    
})
app.get('/about',ensureGuest,(req,res)=>{
    res.render('about',{
        title:'About'
    });
});
app.get('/contact',ensureGuest,(req, res)=>{
    res.render('contact',{
        title: 'Contact'
    });
});
app.get('/auth/facebook',passport.authenticate('facebook',{scope: 'profile'}));
app.get('/auth/facebook/callback',passport.authenticate('facebook',{
      successRedirect: '/profile',
      failureRedirect: '/'
}));
app.get('/auth/google',passport.authenticate('google',{
    scope:['profile']
}));
app.get('/auth/google/callback',passport.authenticate('google',{
    successRedirect: '/profile',
    failureRedirect: '/'
}));
app.get('/profile',requireLogin,(req,res)=>{
    User.findById({_id: req.user._id}).then((user)=>{
        if(user){
            user.online= true;
            user.save((err,user)=>{
                if(err)
                 {throw err;}
                 else {
                    Smile.findOne({receiver:req.user._id,receiverReceived:false})
                    .then((newSmile)=>{
                       Chat.findOne({$or:[
                           {receiver:req.user._id,receiverRead:false},
                           {sender:req.user._id,senderRead:false} 
                       ]})
                       .then((unread)=>{
                       Post.find({postUser:req.user._id})
                       .populate('postUser')
                       
                       .sort({date:'desc'})
                       .then((posts)=>{
                           if(posts){
                               res.render('profile',{
                                   title:'Profile',
                                   user:user,
                                   newSmile: newSmile,
                                   unread: unread,
                                   posts:posts

                               });
                           }else{
                               console.log('user does not have any posts');
                            res.render('profile',{
                                title: 'profile',
                                user:user,
                                newSmile:newSmile,
                                unread:unread
                            });
                           }
                       })
                    })
                       })
                 }
            });
        }
    });
});
app.post('/updateProfile',requireLogin,(req,res)=>{
   User.findById({_id: req.user._id}).then((user)=>{
       user.fullname= req.body.fullname;
       user.email= req.body.email;
       user.gender= req.body.gender;
       user.about= req.body.about;
       user.save(()=>{
           res.redirect('/profile');
       });
   });
});
app.get('/askToDelete',requireLogin,(req,res)=>{
    res.render('askToDelete',{
        title:'Delete'
    });
});
app.get('/deleteAccount',requireLogin,(req,res)=>{
    User.deleteOne({_id: req.user._id}).then(()=>{
        res.render('accountDeleted',{
            title:'Deleted!!'
        });
    });
});
app.get('/newAccount',(req,res)=>{
    res.render('newAccount',{
        title: 'SignUp'
    });
});
app.post('/signup',(req,res)=>{
    console.log(req.body);
    let errors = [];
    if(req.body.password !=req.body.password2)
    {
        errors.push({text: 'passowrd must be same'});
    }
    if(req.body.password.length < 5)
    {
        errors.push({text:'password must atleast enough character'});
    }
    if(errors.length > 0){
        res.render('newAccount',{
            errors: errors,
            title: 'Error',
            fullname: req.body.fullname,
            email: req.body.email,
            password: req.body.password,
            password2: req.body.password2
        });
    }
    else{
       User.findOne({email: req.body.email}).then((user)=>{
           if(user) {
               let errors=[];
               errors.push({text: 'Email already exist'});
               res.render('/newAccount',{
                   title: 'SignUp',
                   errors: errors
               })

           }
           else{
            var salt = bcrypt.genSaltSync(10);
            var hash = bcrypt.hashSync(req.body.password, salt);
               const newUser= {
                   fullname: req.body.username,
                   email: req.body.email,
                   password: hash,

               }
               new User(newUser).save((err,user)=>{
                   if(err)
                   throw err;
                   if(user){
                       let success=[];
                       success.push({text: 'you are successfully registered. You can Login!'});
                       res.render('home',{
                           success : success
                       });
                   }
               })
           }
       })
    }

});
app.post('/login',passport.authenticate('local',{
    successRedirect: '/profile',
    failureRedirect: '/loginErrors'
}));
app.get('/loginErrors',(req,res)=>{
    let errors= [];
    errors.push({text: 'User Not found or password Incorrect'});
    res.render('home',{
        errors: errors
    });
});

app.get('/uploadImage',requireLogin,(req,res)=>{
  res.render('uploadImage',{
      title:'Upload'
  })
})
app.post('/uploadAvatar',(req,res)=>{
    User.findById({_id:req.user._id})
    .then((user)=>{
        user.image= req.body.upload;
        user.save((err)=>{
            if(err){
                throw err;
            }
            else{
                res.redirect('/profile');
            }
        })
    })
})
app.get('/uploadFile',uploadImage.any(),(req,res)=>{
    const form= new formidable.IncomingForm();
    form.on('file',(field,file)=>{
        console.log('file');
    });
    form.on('error',(err)=>{
        console.log(err);
    });
    form.on('end',()=>{
        console.log('image uploaded..');
    });
    form.parse(req);
})
app.get('/singles',requireLogin,(req,res)=>{
    
    User.find({})
    .sort({date:'desc'})
    .then((singles)=>{
        res.render('singles',{
            title: 'singles',
            singles: singles
        })
    }).catch((err)=>{
        console.log(err);
        });
});
app.get('/userProfile/:id',requireLogin,(req,res)=>{
    User.findById({_id:req.params.id})
    .then((user)=>{
       Smile.findOne({receiver:req.params.id})
       .then((smile)=>{
        res.render('userProfile',{
            title: 'Profile',
            oneUser: user,
            smile: smile
        });
       })
    });
});
// Chat
app.get('/startChat/:id',requireLogin,(req,res)=>{
    Chat.findOne({sender: req.params.id, receiver: req.user._id})
    .then((chat)=>{
        if(chat) {
            chat.receiverRead = true,
            chat.senderRead= false;
            chat.date= new Date();
            chat.save((err,chat)=>{
                if(err){
                    throw err;
                }
                if(chat){
                    res.redirect(`/chat/${chat._id}`);
                }
            })
        }
        else{
            Chat.findOne({sender: req.user._id,receiver: req.params.id})
            .then((chat)=>{
            if(chat) {
                chat.senderRead = true;
                chat.receiverRead = false;
                chat.date = new Date();
                chat.save((err,chat)=>{
                    if(err){
                        throw err;
                    }
                    if(chat){
                        res.redirect(`/chat/${chat._id}`);
                    }
                })
            } else{
                const newChat = {
                    sender: req.user._id,
                    receiver: req.params.id,
                    senderRead: true,
                    receiverRead: false,
                    date: new Date()
                }
                new Chat(newChat).save((err,chat)=>{
                    if(err){
                        throw err;
                    }
                    if(chat) {
                        res.redirect(`/chat/${chat._id}`);
                    }
                });
            }
                
            });
        }
    });
});
//Display chat room
app.get('/chat/:id', requireLogin,(req,res)=>{
    Chat.findById({_id: req.params.id})
    .populate('sender')
    .populate('receiver')
    .populate('chats.senderName')
    .populate('chats.receiverName')
    .then((chat)=>{
        User.findOne({_id: req.user._id})
        .then((user)=>{
            res.render('chatRoom',{
                title:'chatRoom',
                user:user,
                chat: chat
            })
        })
    })

});
app.post('/chat/:id',requireLogin,walletChecker,(req,res)=>{
    Chat.findOne({_id:req.params.id, sender:req.user._id})
    .populate('sender')
    .populate('receiver')
    .populate('chats.senderName')
    .populate('chats.receiverName')
    .then((chat)=>{
        // senders message
        if(chat){
            chat.senderRead= true;
            chat.receiverRead= false;
            chat.date= new Date();

            const newChat= {
                senderName: req.user._id,
                senderRead: true,
                receiverName: chat.receiver._id,
                receiverRead: false,
                date: new Date(),
                senderMessage: req.body.chat
            }
            chat.chats.push(newChat)
            chat.save((err,chat)=>{
                if(err)
                {throw err;}
                if(chat)
                {
                    Chat.findOne({_id: chat._id})
                    .populate('sender')
                    .populate('receiver')
                    .populate('chats.senderName')
                    .populate('chats.receiverName')
                    .then((chat)=>{
                        User.findById({_id: req.user._id})
                        .then((user)=>{
                            user.wallet = user.wallet-1;
                            user.save((err,user)=>{
                                if(err){
                                    throw err;
                                }
                                if(user){
                                    res.render('chatRoom',{
                                        title: 'Chat',
                                        chat: chat,
                                        user: user
                                    })
                                }
                            })

                        })
                    })
                }

            })
        }
        // receiver message
        else{
            Chat.findOne({_id: req.params.id,receiver: req.user._id})
            .populate('sender')
            .populate('receiver')
            .populate('chats.senderName')
            .populate('chats.receiverName')
            .then((chat)=>{
                chat.senderRead= true,
                chat.receiverRead= false,
                chat.date= new Date();
                const newChat= {
                    senderName: chat.sender._id,
                    senderRead: false,
                    receiverName: req.user._id,
                    receiverRead: true,
                    receiverMessage: req.body.chat,
                    date: new Date()

                }
                chat.chats.push(newChat)
                chat.save((err,chat)=>{
                    if(err)
                   { throw err;}
                   if(chat){
                       Chat.findOne({_id:chat._id})
                       .populate('sender')
                       .populate('receiver')
                       .populate('chats.senderName')
                       .populate('chats.receiverName')
                       .then((chat)=>{
                           User.findById({_id:req.user._id})
                           .then((user)=>{
                             user.wallet = user.wallet -1;
                             user.save((err,user)=>{
                                 if(err)
                                 {
                                     throw err;
                                 }
                                 if(user)
                                 {
                                     res.render('chatRoom',{
                                         title: 'Chat',
                                         user:user,
                                         chat: chat
                                     })
                                 }
                             })
                           })
                       })
                   }
                })
            })
        }
    })
})
app.get('/chats',requireLogin,(req,res)=>{
    Chat.find({receiver:req.user._id})
    .populate('sender')
    .populate('receiver')
    .populate('chats.senderName')
    .populate('chats.receiverName')
    .sort({date:'desc'})
    .then((received)=>{
     Chat.find({sender:req.user._id})
    .populate('sender')
    .populate('receiver')
    .populate('chats.senderName')
    .populate('chats.receiverName')
    .sort({date:'desc'})
    .then((sent)=>{
       res.render('chat/chats',{
            title:'Chat History',
            received:received,
            sent:sent
        })
    })
        
    })
})
app.get('/deleteChat/:id',requireLogin,(req,res)=>{
    Chat.deleteOne({_id:req.params.id})
    .then(()=>{
        res.redirect('/chats');
    })
})
app.get('/sendSmile/:id',requireLogin,(req,res)=>{
    const newSmile= {
        sender:req.user._id,
        receiver: req.params.id,
        senderSent: true
    }
    new Smile(newSmile).save((err,smile)=>{
        if(err){
            throw err;
        }
        if(smile)
        res.redirect(`/userProfile/${req.params.id}`);
    })
})
app.get('/deleteSmile/:id',requireLogin,(req,res)=>{
    Smile.deleteOne({receiver:req.params.id, sender:req.user._id})
    .then(()=>{
        res.redirect(`/userProfile/${req.params.id}`)
    })
})
app.get('/showSmile/:id', requireLogin,(req,res)=>{
    Smile.findOne({_id:req.params.id})
    .then((smile)=>{
        smile.receiverReceived = true;
        smile.save((err,smile)=>{
            if(err){
                throw err;
            }
            if(smile)
            {
                res.render('smile/showSmile',{
                    title:'New Smile',
                    smile:smile

                })
            }
        })

    })
})
app.get('/displayPostForm',requireLogin,(req,res)=>{
    res.render('post/displayPostForm',{
        title:'Post'
    })
})
app.post('/createPost',requireLogin,(req,res)=>{
    let allowComments= Boolean;
    if(req.body.allowComments){
        allowComments= true;
    }else{
        allowComments= false;
    }
    const newPost= {
        title:req.body.title,
        body: req.body.body,
        status:req.body.status,
        image:`https://s3.amazonaws.com/snuggle-3.0/${req.body.image}`,
        postUser: req.user._id,
        allowComments:allowComments,
        date: new Date()
    }
    if(req.body.status =='public'){
        newPost.icon='fa fa-globe';

    }
    if(req.body.status =='private'){
        newPost.icon='fa fa-key';

    }
    if(req.body.status =='friends'){
        newPost.icon='fa fa-group';

    }
    
    new Post(newPost).save()
    .then(()=>{
        if(req.body.status=='public'){
            res.redirect('/posts');
        }else{
           res.redirect('/profile');
        }
       
    })
});
//display public posts
app.get('/posts',requireLogin,(req,res)=>{
    Post.find({status:'public'})
    .populate('postUser')
    .sort({date:'desc'})
    .then((post)=>{ 
        res.render('post/posts',{
            title:'Posts',
            post:post
        })
    })
    
})
app.get('/deletePost/:id',requireLogin,(req,res)=>{
    Post.deleteOne({_id:req.params.id})
    .then(()=>{
        res.redirect('/profile')
    })
})
app.get('/editPost/:id',requireLogin,(req,res)=>{
   Post.findById({_id:req.params.id})
   .then((post)=>{
       res.render('post/editPost',{
           title:'Editing',
           post:post
       })
   })
})
// update post
app.post('/editPost/:id',requireLogin,(req,res)=>{
    Post.findByIdAndUpdate({_id:req.params.id})
    .then((post)=>{
        let allowComments=Boolean;
        if(req.body.allowComments){
            allowComments= true;
        }else{
            allowComments= false;
        }

        post.title = req.body.title,
        post.body= req.body.body,
        post.status= req.body.status,
        post.allowComments= allowComments,
        post.image=``,
        post.date= new Date()
        if(req.body.status =='public'){
            newPost.icon='fa fa-globe';
    
        }
        if(req.body.status =='private'){
            newPost.icon='fa fa-key';
    
        }
        if(req.body.status =='friends'){
            newPost.icon='fa fa-group';
    
        }
        post.save()
        .then(()=>{
            res.redirect('/profile');
        })

    })
})
app.get('/likePost/:id',requireLogin,(req,res)=>{
   Post.findById({_id:req.params.id})
   .then((post)=>{
       const newLike= {
           likeUser: req.user._id,
           date: new Date()
       }
       post.likes.push(newLike)
       post.save((err,post)=>{
           if(err){
               throw err;
           }
           if(post){
               res.redirect(`/fullPost/${post._id}`);
           }
       })
   })
})
app.get('/fullPost/:id',requireLogin,(req,res)=>{
    Post.findById({_id:req.params.id})
    .populate('postUser')
    .populate('likes.likeUser')
    .populate('comments.commentUser')
    .sort({date:'desc'})
    .then((post)=>{
        res.render('post/fullPost',{
            title:'Full Post',
            post:post
        })
    })
})
app.post('/leaveComment/:id',requireLogin,(req,res)=>{
    Post.findById({_id:req.params.id})
    .then((post)=>{
        const newComment ={
            commentUser: req.user._id,
            commentBody: req.body.commentBody,
            date: new Date()
        }
        post.comments.push(newComment)
        post.save((err,post)=>{
            if(err)
            {
                throw err;
            }
            if(post){
                res.redirect(`/fullPost/${post._id}`)
            }
        })
    })
})
app.get('/logout',(req,res)=>{
    User.findById({_id:req.user._id}).then((user)=>{
        user.online= false;
        user.save((err,user)=>{
            if(err){
                throw err;
            }
            if(user){
                req.logOut();
                res.redirect('/');
            }
        });
    });
});
app.post('/contactUs',(req,res)=>{
    console.log(req.body);
    const newMessage={
        fullname: req.body.fullname,
        email: req.body.email,
        message: req.body.message,
        date: new Date()
    }
    new Message(newMessage).save((err,message)=>{
        if(err){
            throw err;
        }else{
            Message.find({}).then((messages)=>{
                if(messages){
                    res.render('newmessage',{
                        title:'Sent',
                        messages:messages
                    });

                }
                else{
                    res.render('noMessage',{
                        title:'No messages'
                    });
                }
            });
        }
            
            });

    });

app.listen(PORT, ()=>{
    console.log(`server running on ${PORT}`);
})
