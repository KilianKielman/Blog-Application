var fs = require('fs');
var bcrypt = require('bcrypt');

var Sequelize = require('sequelize');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');

var app = express();
app.set('view engine', 'jade');

//middleware for using bodyparser
app.use(bodyParser.urlencoded({
	extended: true
}));

//middleware for using sessions
app.use(session({
	secret: 'oh wow very secret much security',
	resave: true,
	saveUninitialized: false
}));

var sequelize = new Sequelize('my_blog_application', process.env.PSQL_USERNAME, process.env.PSQL_PASSWORD, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		timestamps: false
	}
});

//

//this defines the new table user in sequalize
var User = sequelize.define('user', {
	name: Sequelize.STRING,
	email: Sequelize.STRING,
	password: Sequelize.STRING
});

//this defines the new table post in sequalize
var Post = sequelize.define('post', {
	userid: Sequelize.INTEGER,
	title: Sequelize.STRING,
	content: Sequelize.TEXT,
	author: Sequelize.STRING
});

//this defines the new table comment in sequalize
var Comment = sequelize.define('comment', {
	userid: Sequelize.INTEGER,
	postid: Sequelize.INTEGER,
	title: Sequelize.STRING,
	author: Sequelize.STRING
});

//this renders the homepage with login and register form
app.get('/', function(request, response) {
	response.render('index', {
		message: request.query.message
	});
});

// this is the post request for creating a new user
app.post('/users', function(request, response) {
	var checkUsername = request.body.name;
	var checkPassword = request.body.password;
	var checkEmail = request.body.email;

	if (checkUsername !== "" && checkPassword !== "" && checkEmail !== "") {
		bcrypt.hash(checkPassword, 8, function(err, hash) {
			User.create({
				name: request.body.name,
				email: request.body.email,
				password: hash
			}).then(function(user) {
				response.render('index', {
					succesregister: "You've succesfully created your account!"
				});
			});
		});
	} else {
		response.render('index', {
			errorregister: "Please fill out form"
		});
	}
});


// this is the post request to login
app.post('/login', function(request, response) {
	var checkEmail = request.body.email;
	var checkPassword = request.body.password;

	if (checkPassword !== "" && checkEmail !== "") {
		User.findOne({
				where: {
					email: request.body.email
				}
			})
			.then(function(user) {
				if (user !== null) {
					bcrypt.compare(checkPassword, user.password, function(err, res) {
						request.session.user = user;
						if (res === true) {
							response.redirect('/users/' + user.id);
						}
						if (res === false) {
							response.render('index', {
								errorpassword: "Invalid password"
							});
						}
					})
				} else {
					response.render('index', {
						erroremail: "Invalid emailaddress"
					});
				}
			})
	} else {
		response.render('index', {
			errorempty: "Please fill out form"
		});
	}
})

//the user gets send to this dynamic route, once logged in
app.get('/users/:id', function(request, response) {
	var user = request.session.user;
	if (user === undefined) {
		response.redirect('/?message=' + encodeURIComponent("Please log in to view your profile."));
	} else {
		response.render('profile', {
			user: user,
			userId: request.session.user.id
		});
	}
});

// this is the post request for creating a new post
app.post('/users/createpost', function(request, response) {
	var author = request.session.user.name;
	var title = request.body.title;
	var content = request.body.content;

	Post.create({
		userid: request.session.user.id,
		author: author,
		title: title,
		content: content
	}).then(function(user) {
		response.redirect('/users/:id/posts');
	});
});

//this route loads all posts
app.get('/users/:id/allposts', function(request, response) {
	Post.findAll().then(function(posts) {
		var data = posts.map(function(post) {
			return {
				id: post.dataValues.id,
				author: post.dataValues.author,
				userid: post.dataValues.userid,
				title: post.dataValues.title,
				content: post.dataValues.content
			};
		});
		data = data.reverse();
		response.render('users/posts', {
			data: data,
			userId: request.session.user.id
		});
	});
});

//this route loads the posts of a specific user
app.get('/users/:id/posts', function(request, response) {
	Post.findAll({
		where: {
			userid: request.session.user.id
		}
	}).then(function(posts) {
		var data = posts.map(function(post) {
			return {
				id: post.dataValues.id,
				author: post.dataValues.author,
				userid: post.dataValues.userid,
				title: post.dataValues.title,
				content: post.dataValues.content
			};
		});
		data = data.reverse();
		response.render('users/posts', {
			data: data,
			userId: request.session.user.id
		});
	});
});

app.get('/users/:id/post/:ip', function(request, response) {

	Promise.all([
		Comment.findAll({
			where: {
				postid: request.params.ip
			}
		}),

		Post.findAll({
			where: {
				id: request.params.ip
			}
		})
	]).then(function(result) {
		var comment = result[0].map(function(comment) {
			return {
				id: comment.dataValues.id,
				author: comment.dataValues.author,
				userid: comment.dataValues.userid,
				title: comment.dataValues.title
			};
		})
		var post = result[1].map(function(post) {
			return {
				id: post.dataValues.id,
				author: post.dataValues.author,
				userid: post.dataValues.userid,
				title: post.dataValues.title,
				content: post.dataValues.content
			};
		});

		response.render('users/post', {
			post: post,
			comment: comment,
			userId: request.session.user.id,
			postId: request.params.ip
		});
	});
});

// this is the post request for creating a new comment
app.post('/users/:id/post/:ip/createcomment', function(request, response) {
	var userid = request.session.user.id;
	var postid = request.params.ip;
	var author = request.session.user.name;
	var title = request.body.title;

	Comment.create({
		userid: userid,
		postid: postid,
		author: author,
		title: title
	}).then(function(user) {
		response.redirect('/users/' + userid + '/post/' + postid);
	});
});

//this makes it possible for a user to logout
app.get('/logout', function(request, response) {
	request.session.destroy(function(error) {
		if (error) {
			throw error;
		}
		response.render('index', {
			logout: "Successfully logged out."
		});
	})
});

sequelize.sync({
	force: true
}).then(function() {
	var server = app.listen(3000, function() {
		console.log('Example app listening on port: ' + server.address().port);
	});
});