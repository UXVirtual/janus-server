var Auth = require('../../Auth');
var config = require('sequelize-cli/bin/config/config.json');
var genericHelper = require('sequelize-cli/lib/helpers/generic-helper');
var envConfig = config[genericHelper.getEnvironment()];

var events = require('events');
var ErrorEvent = require('../../events/ErrorEvent');
var AuthEvent = require('../../events/AuthEvent');

global.log = require('../../Logging');

var Database = require('../Database');
var database = new Database();
var sequelize = database.connect();
var Group = sequelize.import("../../../src/models/Group");
var Permission = sequelize.import("../../../src/models/Permission");
var GroupPermission = sequelize.import("../../../src/models/GroupPermission");

/**
 * DatabaseSeeder
 *
 * Seeds the database with initial admin user accounts, groups etc
 *
 * @constructor
 */
function DatabaseSeeder() {

}

DatabaseSeeder.prototype.run = function() {

    //deleting groups

    log.info('Deleting all groups...');

    sequelize.query("TRUNCATE TABLE `"+Group.tableName+"`")
    .then(function(){
        log.info('Deleted all groups.');

        //create groups
        log.info('Creating groups...');

        Group.bulkCreate([
            {name:'admin',description:'Admins',enabled:1, level:1},
            {name:'user',description:'Users',enabled:1, level:2}
        ],{validate:true}).then(function(){
                log.info('Created groups.');
        }).then(function(){

                //create permissions
                sequelize.query("TRUNCATE TABLE `"+Permission.tableName+"`").then(function(){
                    sequelize.query("TRUNCATE TABLE `"+GroupPermission.tableName+"`").then(function(){
                        log.info('Deleted all permissions.');

                        log.info('Creating permissions...');

                        Permission.bulkCreate([
                            {name:'allow_user_ban',description:'Allow banning of users in groups lower than yours.'},
                            {name:'allow_user_edit',description:'Allow editing of users in groups lower than yours.'},
                            {name:'allow_reset_room',description:'Allow resetting of rooms.'}
                        ],{validate:true}).then(function(){
                                log.info('Created permissions.');

                                //create admin user
                                var auth = new Auth();

                                log.info('Creating users...');

                                auth.once(ErrorEvent.userExists,function(e){
                                    log.info(e.message);
                                    log.info('Did not insert admin user - already exists.');
                                });

                                auth.once(AuthEvent.userAdded,function(e){
                                    log.info(e.message);

                                    auth.once(AuthEvent.groupAddedPermissions,function(e){

                                        log.info(e.message);
                                    });
                                    auth.addPermissions('admin',['allow_user_ban','allow_user_edit','allow_reset_room']);
                                });

                                auth.addUser('admin',envConfig.defaultAdminPass,'admin@janusvr.com',['admin']);
                            });
                    });
                });



            })
    })

};

var databaseSeeder = new DatabaseSeeder();

databaseSeeder.run();




