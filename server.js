/*********************************************************************************
 * WEB322 – Assignment 06
 * I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part
 * of this assignment has been copied manually or electronically from any other source
 * (including 3rd party web sites) or distributed to other students.
 *
 * Name: SURAJ KHANAL ID: 044435113 Date: 30/11/2022
 *
 * Online (Cyclic) Link: https://pear-bonobo-cape.cyclic.app
 *
 ********************************************************************************/

const express = require("express");
const path = require("path");
const data = require("./data-service.js");
const auth = require("./data-service-auth.js");
const fs = require("fs");
const multer = require("multer");
const exphbs = require('express-handlebars');
const app = express();

const HTTP_PORT = process.env.PORT || 8080;

function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}

app.engine('.hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: "main",
    helpers: {
        navLink: function (url, options) {
            return '<li' +
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    }
}));

app.set('view engine', '.hbs');

// multer requires a few options to be setup to store files with file extensions
// by default it won't store extensions for security reasons
const storage = multer.diskStorage({
    destination: "./public/images/uploaded",
    filename: function (req, file, cb) {
        // we write the filename as the current date down to the millisecond
        // in a large web service this would possibly cause a problem if two people
        // uploaded an image at the exact same time. A better way would be to use GUID's for filenames.
        // this is a simple example.
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// tell multer to use the diskStorage function for naming files instead of the default.
const upload = multer({ storage: storage });

app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/students", ensureLogin, async (req, res) => {
    let result;
    try {
        if (req.query.status) {
            result = await data.getStudentsByStatus(req.query.status)
        } else if (req.query.program) {
            result = await data.getStudentsByProgramCode(req.query.program)
        } else if (req.query.credential) {
            result = await data.getStudentsByExpectedCredential(req.query.credential)
        } else {
            result = await data.getAllStudents()
        }
    } catch (err) {
        return res.render("students", { message: "no results" });
    }

    if (result.length > 0) {
        return res.render("students", { students: result });
    } else {
        return res.render('students', { message: 'no results' })
    }
});

app.get("/student/:studentId", ensureLogin, (req, res) => {
    const { studentId } = req.params
    let viewData = {}
    data
        .getStudentById(studentId)
        .then((data) => {
            if (data) {
                viewData.student = data
            } else {
                viewData.student = null
            }
        })
        .catch(() => {
            viewData.student = null
        })
        .then(data.getPrograms)
        .then((data) => {
            viewData.programs = data
            for (let i = 0; i < viewData.programs.length; i++) {
                if (viewData.programs[i].programCode == viewData.student.program) {
                    viewData.programs[i].selected = true
                }
            }
        })
        .catch(() => {
            viewData.programs = []
        })
        .then(() => {
            if (viewData.student === null) {
                res.render('student', { message: 'no results' })
            } else {
                res.render('student', { viewData })
            }
        })
        .catch(() => {
            res.render('student', { message: 'Unable to Show Students' })
        })
});

app.get("/intlstudents", ensureLogin, (req, res) => {
    data
        .getInternationalStudents()
        .then((data) => {
            res.render('students', { students: data })
        })
        .catch((err) => {
            res.json({ message: err })
        })
});

app.get('/students/add', ensureLogin, (_, res) => {
    data
        .getPrograms()
        .then((data) => {
            res.render('addStudent', { programs: data })
        })
        .catch(() => {
            res.render('addStudent', { programs: [] })
        })
})

app.post("/students/add", ensureLogin, (req, res) => {
    data.addStudent(req.body)
        .then(() => {
            res.redirect('/students')
        })
        .catch((err) => {
            res.json({ message: err })
        })
});

app.get('/students/delete/:studentID', ensureLogin, (req, res) => {
    data.deleteStudentById(req.params.studentID)
        .then(() => {
            res.redirect('/students')
        })
        .catch(() => {
            res.status(500).send('Unable to Remove Student / Student not found)')
        })
})

app.post("/student/update", ensureLogin, (req, res) => {
    data.updateStudent(req.body).then(() => {
        res.redirect("/students");
    });
});

app.get("/images", ensureLogin, (req, res) => {
    fs.readdir("./public/images/uploaded", function (err, items) {
        res.render("images", { images: items });
    });
});

app.get('/images/add', ensureLogin, (_, res) => {
    res.render('addImage')
})

app.post("/images/add", ensureLogin, upload.single("imageFile"), (req, res) => {
    res.redirect("/images");
});

app.get("/programs", ensureLogin, (req, res) => {
    data.getPrograms()
        .then((data) => {
            if (data.length > 0) {
                res.render('programs', { programs: data })
            }
            else {
                res.render('programs', { programs: [] })
            }
        })
        .catch((err) => {
            res.render('programs', { message: err, programs: [] })
        })
});

app.get('/programs/add', ensureLogin, (_, res) => {
    res.render('addProgram')
})

app.post('/programs/add', ensureLogin, (req, res) => {
    data.addProgram(req.body)
        .then(() => {
            res.redirect('/programs')
        })
        .catch((err) => {
            res.json({ message: err })
        })
})

app.post('/programs/update', ensureLogin, (req, res) => {
    data.updateProgram(req.body)
        .then(() => {
            res.redirect('/programs')
        })
        .catch((err) => {
            res.json({ message: err })
        })
})

app.get('/program/:programCode', ensureLogin, (_, res) => {
    const { programCode } = req.params
    data.getProgramByCode(programCode)
        .then((data) => {
            if (data) {
                res.render('program', { program: data })
            } else {
                res.status(404).send('Program Not Found')
            }
        })
        .catch(() => {
            res.status(404).send('Program Not Found')
        })
})

app.get('/programs/delete/:programCode', ensureLogin, (req, res) => {
    const { programCode } = req.params
    data.deleteProgramByCode(programCode)
        .then((data) => {
            if (data) {
                res.render('programs', { program: data })
            } else {
                res.status(404).send('Unable to Remove Program / Program not found)')
            }
        })
        .catch(() => {
            res.status(500).send('Unable to Remove Program / Program not found)')
        })
})

app.get('/login', (req, res) => {
	res.render('login')
})

app.get('/register', (req, res) => {
	res.render('register')
})

app.post('/register', (req, res) => {
	authService
		.registerUser(req.body)
		.then(() => {
			res.render('register', { successMessage: 'User created' })
		})
		.catch((err) => {
			res.render('register', { errorMessage: err, userName: req.body.userName })
		})
})

app.post('/login', (req, res) => {
	req.body.userAgent = req.get('User-Agent');
	authService
		.checkUser(req.body)
		.then((user) => {
			req.session.user = {
				userName: user.userName,// authenticated user's userName
				email: user.email, // authenticated user's email
				loginHistory: user.loginHistory// authenticated user's loginHistory
			}
		
			res.redirect('/students');
		})
		.catch((err) => {
			res.render('login', { errorMessage: err, userName: req.body.userName })
		})
})

app.get('/logout', (req, res) => {
	req.session.reset();
	res.redirect('/');
})

app.get('/userHistory', ensureLogin, (req, res) => {
	res.render('userHistory')
})

app.use('*', (req, res) => {
    res.status(404).send("Page Not Found");
});

data.initialize().then(auth.initialize).then(function () {
    app.listen(HTTP_PORT, function () {
        console.log("app listening on: " + HTTP_PORT)
    });
}).catch(function (err) {
    console.log("unable to start server: " + err);
});


