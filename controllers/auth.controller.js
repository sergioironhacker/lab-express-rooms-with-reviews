const mongoose = require('mongoose');
const User = require('../models/User.model');
const passport = require("passport");

module.exports.register = (req, res, next) => {
  res.render('auth/register');
};

module.exports.doRegister = (req, res, next) => {
  const { username, email, password } = req.body;

  User.findOne({ email })
    .then((dbUser) => {
      if (dbUser) {
        res.render('auth/register', {
          user: {
            email,
            username,
          },
          errors: {
            email: 'Email already registered!',
          },
        });
      } else {
        User.create({
          username,
          email,
          password,
        })
          .then((userCreated) => {
            const {
              transporter,
              createEmailTemplate,
            } = require('../config/nodemailer.config');
            
            transporter.sendMail(
              {
                from: process.env.NODEMAILER_EMAIL,
                to: email,
                subject: 'Ironbooks - Validation email',
                html: createEmailTemplate(userCreated),
              },
              function (error, info) {
                if (error) {
                  console.log(error);
                } else {
                  console.log('Email sent: ' + info.response);
                }
                res.redirect('/login');
              }
            );
          })
          .catch((error) => {
            if (error instanceof mongoose.Error.ValidationError) {
              res.render('auth/register', {
                user: {
                  email,
                  username,
                },
                errors: error.errors, // {  EMAIL: 'lo que sea', PASSWOR: '', USERNAME: ''}
              });
            } else {
              next(error);
            }
          });
      }
    })
    .catch((err) => {
      console.error(err);
    });
};

module.exports.activate = (req, res, next) => {
  const { token } = req.params;
  User.findOneAndUpdate({ activationToken: token }, { isActive: true }, { new: true })
    .then((dbUser) => {
      res.render('auth/login', { email: dbUser.email });
    })
    .catch((error) => next(error));
};

module.exports.login = (req, res, next) => {
  res.render('auth/login', { errors: false });
};

module.exports.doLogin = (req, res, next) => {
  const { email, password } = req.body;

  const renderWithErrors = (msg) => {
    res.render('auth/login', {
      email,
      errors: {
        msg: msg || 'Email or password are incorrect',
      },
    });
  };

  if (!email || !password) {
    renderWithErrors();
  } else {
    User.findOne({ email })
      .then((dbUser) => {
        if (!dbUser) {
          renderWithErrors();
        } else {
          dbUser
            .checkPassword(password)
            .then((match) => {
              if (!match) {
                renderWithErrors();
              } else {
                if (!dbUser.isActive) {
                  renderWithErrors('User not active');
                } else {
                  req.session.currentUser = dbUser;
                  res.redirect('/profile');
                }
              }
            })
            .catch((err) => next(err));
        }
      })
      .catch((err) => next(err));
  }
};

module.exports.doLoginGoogle = (req, res, next) => {
  passport.authenticate('google-auth', (error, user, validations) => {
    if (error) {
      next(error);
    } else if (!user) {
      res.status(400).render('auth/login', { user: req.body, error: validations });
    } else {
      req.login(user, loginErr => {
        if (loginErr) next(loginErr)
        else {
          req.session.currentUser = user;
          // console.log(req.user);
          // console.log(req.session.passport.user);
          res.redirect('/profile');
        }
      })
    }
  })(req, res, next)
}

module.exports.logout = (req, res, next) => {
  req.session.destroy();
  res.clearCookie('connect.sid');
  res.redirect('/login');
};
