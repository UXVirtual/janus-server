var bcrypt = require('bcrypt');
var Database = require('./database/Database');
var database = new Database();
var sequelize = database.connect();
var Sequelize = require('sequelize');

var events = require('events');
var ErrorEvent = require('./events/ErrorEvent');
var AuthEvent = require('./events/AuthEvent');

var User = sequelize.import(__dirname+"/models/User");
var Group = sequelize.import(__dirname+"/models/Group");
var Permission = sequelize.import(__dirname+"/models/Permission");
var GroupPermission = sequelize.import(__dirname+"/models/GroupPermission");
var GroupUser = sequelize.import(__dirname+"/models/GroupUser");

function Auth() {

    events.EventEmitter.call(this);
}

module.exports = Auth;

//allow the class to emit events
Auth.prototype.__proto__ = events.EventEmitter.prototype;

Auth.prototype.addUser = function(username,password,email,groups) {
    //encrypt password synchronously

    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(password, salt);

    var self = this;

    User.find({ where: {username: username} }).then(function(user){

        var errorEvent = new ErrorEvent();
        var authEvent = new AuthEvent();

        //user already exist - throw error event
        if(user){
            self.emit(ErrorEvent.userExists,errorEvent.userExists);
        }else{
            User.create({username: username, password: hash, email: email, enabled: 1}).then(function(user){
                log.info('Created user: '+user.username);

                var groupAddedCount = 0;
                for(var i = 0; i < groups.length; i++){
                    Group.find({name: groups[i]}).then(function(group){
                        self.once(AuthEvent.userAddedGroup,function(e){
                            if(groupAddedCount == groups.length-1){
                                //successfully created the user and added it to specified groups
                                self.emit(AuthEvent.userAdded,authEvent.userAdded);
                            }
                        });
                        self.addToGroup(user,group);
                    });
                }
            });
        }

    });


}

//TODO: remove user from groups before removing user record
Auth.prototype.removeUser = function(username) {
    var self = this;

    User.find({ where: {username: username} }).then(function(user){
        //user does not exist - throw error event

        var errorEvent = new ErrorEvent();
        var authEvent = new AuthEvent();

        //console.log(user);

        if(user == null){
            self.emit(ErrorEvent.userNotExists,errorEvent.userNotExists);
        }else{

            self.once(AuthEvent.userRemovedAllGroups,function(e){

                log.info(e.message);

                user.destroy().then(function(user){
                    log.info('Deleted user: '+user.username);

                    self.emit(AuthEvent.userRemoved,authEvent.userRemoved);
                });
            });

            self.removeFromAllGroups(user);


        }
    });
}

Auth.prototype.authenticate = function(username,password) {
    var self = this;

    var errorEvent = new ErrorEvent();
    var authEvent = new AuthEvent();

    //get user
    User.find({ where: {username: username} }).then(function(user){

        if(user == null){
            self.emit(ErrorEvent.userNotExists,errorEvent.userNotExists);
        }else{
            //check password is correct
            bcrypt.compare(password, user.password, function(err, res) {
                if(res){
                    self.emit(AuthEvent.userAuthenticated,authEvent.userAuthenticated);
                }else{
                    self.emit(ErrorEvent.userPasswordInvalid,errorEvent.userPasswordInvalid);
                }
            });
        }
    });
}

Auth.prototype.resetPassword = function() {

}



Auth.prototype.removeFromAllGroups = function(user){
    User.hasMany(Group,{foreignKey: 'userId', through:GroupUser});
    Group.hasMany(User,{foreignKey: 'groupId', through:GroupUser});

    var authEvent = new AuthEvent();

    var self = this;

    user.setGroups([]).then(function(){
        self.emit(AuthEvent.userRemovedAllGroups,authEvent.userRemovedAllGroups);
    });
}

Auth.prototype.addToGroup = function(user,group) {
    //define relationships of users to groups. Make sure to include the join model
    //these relationships must be placed outside of the model
    User.hasMany(Group,{foreignKey: 'userId', through:GroupUser});
    Group.hasMany(User,{foreignKey: 'groupId', through:GroupUser});

    var authEvent = new AuthEvent();

    var self = this;

    //since the relationship of users to groups is defined above, we can now access the `addGroup()` method of the user
    //model
    user.addGroup(group).then(function(){
     log.info('User added to group: '+group.description);
        self.emit(AuthEvent.userAddedGroup,authEvent.userAddedGroup);
     });
}

Auth.prototype.addPermissions = function(groupName,permissionsNames) {


    //define relationships of users to groups. Make sure to include the join model
    //these relationships must be placed outside of the model
    Group.hasMany(Permission,{foreignKey:'groupId',through:GroupPermission});
    Permission.hasMany(Group,{foreignKey:'permissionId',through:GroupPermission});

    var authEvent = new AuthEvent();

    var self = this;

    Group.find({name:groupName}).then(function(group){

        Permission.findAll({
            where: Sequelize.or({name:permissionsNames})
        }).then(function(permissions){

            group.addPermissions(permissions).then(function(){
                self.emit(AuthEvent.groupAddedPermissions,authEvent.groupAddedPermissions);
            });
        });
    });
}
