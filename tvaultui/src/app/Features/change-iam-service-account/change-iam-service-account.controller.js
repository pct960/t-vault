/*
* =========================================================================
* Copyright 2019 T-Mobile, US
* 
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
* See the readme.txt file for additional language around disclaimer of warranties.
* =========================================================================
*/

'use strict';
(function (app) {
    app.controller('ChangeIamServiceAccountCtrl', function ($scope, $rootScope, Modal, $timeout, fetchData, $http, UtilityService, Notifications, $window, $state, $stateParams, $q, SessionStore, vaultUtilityService, ModifyUrl, AdminSafesManagement, AppConstant, $filter, filterFilter, orderByFilter, RestEndpoints) {
        $scope.selectedGroupOption = '';            // Selected dropdown value to be used for filtering
        $rootScope.showDetails = true;              // Set true to show details view first
        $rootScope.activeDetailsTab = 'details';
        $scope.svcaccOnboarded = false;                 // Flag to indicate if a svcacc has been onboarded
        $scope.isEditSvcacc = false;
        $scope.awsRadioBtn = {};                    // Made an object instead of single variable, to have two way binding between
        $scope.approleRadioBtn = {};                                    // modal and controller
        $scope.isCollapsed = true;
        $scope.isSvcaccExpired = false;
        $scope.expiredNote = '';
        $scope.svcInputSelected = false;
        $scope.customTTL = '';
        $scope.permissionChangeInProgress = false;
        $scope.usrRadioBtnVal = 'read';             // Keep it in lowercase
        $scope.grpRadioBtnVal = 'read';             // Keep it in lowercase
        $scope.awsRadioBtn['value'] = 'read';       // Keep it in lowercase
        $scope.approleRadioBtn['value'] = 'read';
        $scope.isEmpty = UtilityService.isObjectEmpty;
        $scope.roleNameSelected = false;
        $scope.userAutoCompleteEnabled = false;
        $scope.groupAutoCompleteEnabled = false;
        $scope.disableAddBtn = true;
        $scope.awsConfPopupObj = {
            "auth_type":"",
            "role": "",
            "bound_account_id": "",
            "bound_region": "",
            "bound_vpc_id": "",
            "bound_subnet_id": "",
            "bound_ami_id": "",
            "bound_iam_instance_profile_arn": "",
            "bound_iam_role_arn": "",
            "policies": "",
            "bound_iam_principal_arn": "",
            "resolve_aws_unique_ids":"false"
        };
        $scope.approleConfPopupObj = {
            "token_max_ttl":"",
            "token_ttl": "",
            "role_name": "",
            "policies": "",
            "bind_secret_id": "",
            "secret_id_num_uses": "",
            "secret_id_ttl": "",
            "token_num_uses": ""
        };
        $scope.tableOptions = [
            
        ];

        $scope.radio = {
            value: 'read',
            options: [{
                'text': 'read'
            }, {
                'text': 'rotate'
            }, {
                'text': 'deny'
            }]
        };

        $scope.appNameTableOptions = [];

        $scope.bindSecretRadio = {
            value: 'false',
            options: [{
                'text': 'false'
            }, {
                'text': 'true'
            }]
        };

        $scope.detailsNavTags = [{
            displayName: 'DETAILS',
            navigationName: 'details',
            addComma: true,
            show: true
        }, {
            displayName: 'PERMISSIONS',
            navigationName: 'permissions',
            addComma: false,
            show: false
        }];

        $scope.inputValue = {
            "userNameVal": '',
            "grpNameVal": '',
            "userNameValEmpty": false,
            "grpNameValEmpty": false
        }

        var clearInputPermissionData = function () {
            $scope.inputValue = {
                "userNameVal": '',
                "grpNameVal": '',
                "userNameValEmpty": false,
                "grpNameValEmpty": false
            }
            $scope.permissionChangeInProgress = false;
            $scope.disableAddBtn = true;
            $scope.clearInputValue("addUser");
            $scope.clearInputValue("addGroup");
        }

        $scope.isApproleBtnDisabled = function() {
            if ($scope.roleNameSelected){
                    return false;
            }
            return true;
        }

        $scope.goBack = function () {
            var targetState = 'manage';
            if (SessionStore.getItem("isAdmin") === 'true') {
                targetState = 'admin';
            }
            if ($scope.goBackToAdmin !== true) {
                if ($rootScope.showDetails === true) {
                    $state.go(targetState);
                }
                else {
                    $rootScope.showDetails = true;
                    $rootScope.activeDetailsTab = 'details';
                }
            }
            else {
                if ($rootScope.lastVisited) {
                    $state.go($rootScope.lastVisited);
                } else
                    $state.go(targetState);
            }
        }

        $scope.roleNameSelect = function() {
            var queryParameters = $scope.dropDownRoleNames.selectedGroupOption.type;
            $scope.roleNameSelected = true;
            $scope.approleConfPopupObj.role_name = queryParameters;
        }

        $scope.selectAppName = function (applicationObj) {
            $scope.applicationName = applicationObj;
            $scope.svcacc.appName = applicationObj.type;
            $scope.appNameSelected = true;
        }

        $scope.error = function (size) {
            Modal.createModal(size, 'error.html', 'ChangeIamServiceAccountCtrl', $scope);
        };

        /************************  Functions for autosuggest start here ***************************/
        //initialise values
        $scope.domainName = '';
        if (AppConstant.DOMAIN_NAME) {
            $scope.domainName = AppConstant.DOMAIN_NAME.toLowerCase();
        }       
        $scope.searchValue = {
            userName: '',
            groupName: ''
        };
        $scope.userNameDropdownVal = [];
        $scope.groupNameDropdownVal = [];
        
        $scope.totalDropdownVal = [];
        $rootScope.loadingDropDownData = false;
        
        $scope.showInputLoader = {
            'show':false
        };
        $scope.inputSelected = {
            'select': false
        }

        var delay = (function(){
            var timer = 0;
            return function(callback, ms){
              clearTimeout (timer);
              timer = setTimeout(callback, ms);
            };

        })(); 
        var lastContent;
        var duplicateFilter = (function(content){
          return function(content,callback){
            content=$.trim(content);
            // callback provided for content length > 2
            if(content !== lastContent && content.length > 2){
              callback(content);
            }
            lastContent = content;
          };
        })();

        //clear selected value on cross icon click
        $scope.clearInputValue = function(id) {
            document.getElementById(id).value = "";
            $scope.inputSelected.select = false;
            $scope.searchValue = {
                userName: '',
                groupName: ''
            };
            lastContent = '';
            $scope.showNoMatchingResults = false;
            $scope.disableAddBtn = true;
        }

        // function call on input keyup 
        $scope.onKeyUp = function(newVal, variableChanged, forOwner) {
            if (newVal.length === 0) {
                return;
            }
            $scope.invalidEmail = false;
            $scope.showNoMatchingResults = false;        
            $scope.showInputLoader.show = false;
            $scope.inputSelected.select = false;
            $scope.autoCompleteforOwner = false;
            //check autocomplete is for owner email id
            if(forOwner) {
                $scope.autoCompleteforOwner = true;
            }
            if (newVal.userName && variableChanged === 'userName') {
                newVal.groupName = "";    
                $scope.userNameDropdownVal = [];
            } else if (newVal.groupName &&  variableChanged === 'groupName') {
                newVal.userName = "";
                $scope.groupNameDropdownVal = [];
            } 
             if (variableChanged === 'userName') {
                if (!UtilityService.getAppConstant('AD_USERS_AUTOCOMPLETE') ) {
                    return;
                }
             } else if (variableChanged === 'groupName') {
                 if(!UtilityService.getAppConstant('AD_GROUP_AUTOCOMPLETE')) {
                    return;
                 }
             }
             var newLetter = newVal[variableChanged];
             if (variableChanged != 'userName'  && variableChanged != 'groupName') {
                newLetter = newLetter.replace(" ", "");
             }

                initiateAutoComplete(variableChanged, ['loading']);
           // delay before providing api call      
          delay(function(){
              // check for duplicate values with previous value
            duplicateFilter(newLetter, function(value){
                $scope.showInputLoader.show = true;
                $scope.getDropdownDataForPermissions(variableChanged, value, forOwner);                
            });          
          }, 500 ); // delay of 500ms provided before making api call
        }

        $scope.getDropdownDataForPermissions = function (searchFieldName, searchFieldText, forOwner) {      
            if (searchFieldText.length > 2) {
                vaultUtilityService.getDropdownDataForPermissions(searchFieldName, searchFieldText, forOwner).then(function (res, error) {
                    var serviceData;
                    if (res) {
                        serviceData = res;
                        $scope.loadingDataFrDropdown = serviceData.loadingDataFrDropdown;
                        $scope.erroredFrDropdown = serviceData.erroredFrDropdown;
                        $scope.successFrDropdown = serviceData.successFrDropdown;
                        if (serviceData.response.data.data.values.length === 0) {
                            $scope.showNoMatchingResults = true;
                        }
                        massageDataFrPermissionsDropdown(searchFieldName, searchFieldText, serviceData.response.data.data.values, forOwner);
                        $scope.$apply();
                    } else {
                        serviceData = error;
                        $scope.commonErrorHandler(serviceData.error, serviceData.error || serviceData.response.data, "getDropdownData");

                    }
                },
                function (error) {
                    // Error handling function when api fails
                    $scope.showInputLoader.show = false;
                    if (error.status === 500) {
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_NETWORK');
                        $scope.error('md');
                    } else if(error.status !== 200 && (error.xhrStatus === 'error' || error.xhrStatus === 'complete')) {                        
                        if (searchFieldName === "userName" && $scope.searchValue.userName.length > 0) {
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_AUTOCOMPLETE_USERNAME');
                        } else if (searchFieldName === "groupName" && $scope.searchValue.groupName.length > 0) {
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_AUTOCOMPLETE_GROUPNAME');
                        }
                        $scope.error('md');
                    }                    
                })
            }
        };
        $scope.commonErrorHandler = function (error, response, block) {
            if (block === null) {
                $scope.loadingDataFrRoles = false;
                $scope.erroredInRoles = true;
                $scope.successInRoles = false;
                $scope.errorMsgFrRoles = "Please try again, if the issue persists contact Vault Administrator";
                console.log("Data from service is not in expected Format ", error);
                if ((response != undefined) || (response != null)) {
                    if (response.message) {
                        $scope.errorMsg = response.message;
                        console.log(response.message);
                    }
                }
            }
        }
        var massageDataFrPermissionsDropdown = function (searchFieldName, searchFieldText, dataFrmApi, forOwner) {
            var serviceData = vaultUtilityService.massageDataFrPermissionsDropdown(searchFieldName, searchFieldText, dataFrmApi, forOwner);
            $scope.showInputLoader.show = false;
               if (searchFieldName === 'userName') {
                    $scope.userNameDropdownVal = serviceData.sort();
                    initiateAutoComplete(searchFieldName, $scope.userNameDropdownVal, forOwner);
                } else if (searchFieldName === 'groupName') {
                    $scope.groupNameDropdownVal = serviceData.sort();
                    initiateAutoComplete(searchFieldName, $scope.groupNameDropdownVal, forOwner);
                }        
           
            $rootScope.loadingDropDownData = false;
        }

        var initiateAutoComplete = function(searchFieldName, data, forOwner) {
            var id;
            if (searchFieldName === "userName") {
                id = '#addUser';
                // for owner email id provide autocomplete
                if ($scope.autoCompleteforOwner) {
                    id = "#addOwnerEmail"
                }
            } else if (searchFieldName === "groupName") {
                id = '#addGroup';
            }
            $(id).focusout();
            $(id).trigger("focus");             
            $(id)
                .autocomplete({
                    source: data,
                    minLength: 3,
                    select: function(event, ui) {                        
                        var selectedName = ui.item.value.toLowerCase();
                        if (selectedName.includes(".com")) {
                            event.preventDefault();
                            if ($scope.autoCompleteforOwner) {
                                this.value = ui.item.value;
                            }else if (searchFieldName === "userName") {
                                this.value = ui.item.value.split(' - ')[1];
                            } else if (searchFieldName === "groupName") {
                                this.value = ui.item.value.split(' - ')[0];
                            }                 
                        }
                        $scope.inputSelected.select = true; 
                        $scope.showNoMatchingResults = false;  
                        $scope.invalidEmail = false;                
                        $scope.disableAddBtn = false;
                        $(id).blur();                     
                        $scope.$apply();
                    },
                    focus: function(event, ui) {
                        event.preventDefault();
                    }
                })
                .focus(function() {
                    $(this).keydown();
                })
                .select(function() {
                    $scope.inputSelected.select = true;
                    $scope.showNoMatchingResults = false; 
                });
        }


        /***************************************  Functions for autosuggest end here **********************************************/

        $scope.svcaccDone = function () {
            $scope.goBackToAdmin = true;
            $scope.goBack();
        }


        //EDIT PERMISSION FUNCTION
        $scope.editPermission = function (type, editMode, user, permission) {
            if (editMode) {
                var editingPermission = true;
                $scope.deletePermission(type, editMode, editingPermission, user, permission);
            }
        }


        //DELETE PERMISSION FUNCTION 
        $scope.deletePermission = function (type, editMode, editingPermission, key, permission) {
            $scope.permissionChangeInProgress = true;
            if (editMode) {
                try {
                    key = key.replace($scope.domainName, '');
                    $scope.isLoadingData = true;
                    var svcaccname = $scope.svcacc.svcaccId;
                    var awsAccountId = $scope.svcacc.awsAccId;
                    var iamsvcId = awsAccountId+"_"+svcaccname;
                    var apiCallFunction = '';
                    var reqObjtobeSent = {};
                    switch (type) {
                        case 'users' :
                            apiCallFunction = AdminSafesManagement.deleteUserPermissionFromIAMSvcacc;
                            if (SessionStore.getItem("username") == key) {
                                $scope.isLoadingData = false;
                                clearInputPermissionData();
                                $scope.errorMessage = "Owner permission for an IAM service account cannot be changed!";
                                $scope.error('md');
                                getSvcaccInfo(iamsvcId);
                                return;
                            }
                            if (editingPermission) {
                                reqObjtobeSent = {
                                    "iamSvcAccName": svcaccname,
                                    "username": key,
                                    "access": permission,
                                    "awsAccountId": awsAccountId
                                };
                            }
                            else {
                                reqObjtobeSent = {
                                    "iamSvcAccName": svcaccname,
                                    "username": key,
                                    "access": permission,
                                    "awsAccountId": awsAccountId
                                };
                            }
                            break;
                        case 'groups' :
                            apiCallFunction = AdminSafesManagement.deleteGroupPermissionFromIAMSvcacc;
                            reqObjtobeSent = {
                                "iamSvcAccName": svcaccname,
                                "groupname": key,
                                "access": permission,
                                "awsAccountId": awsAccountId
                            };
                            break;
                        case 'AWSPermission':
                            apiCallFunction = AdminSafesManagement.detachAWSPermissionFromIAMSvcacc;
                            reqObjtobeSent = {
                                "iamSvcAccName": svcaccname,
                                "rolename": key,
                                "access": permission,
                                "awsAccountId": awsAccountId
                            };
                            break;
                        case 'AppRolePermission':
                            apiCallFunction = AdminSafesManagement.detachAppRolePermissionFromIAMSvcacc;
                            reqObjtobeSent = {
                                "iamSvcAccName": svcaccname,
                                "approlename": key,
                                "access": permission,
                                "awsAccountId": awsAccountId
                            };
                            break;
                    }
                    apiCallFunction(reqObjtobeSent).then(
                        function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    $scope.isLoadingData = false;
                                    $scope.permissionChangeInProgress = false;
                                    if (editingPermission) {
                                        $scope.addPermission(type, key, permission, true);  // This will be executed when we're editing permissions
                                    }
                                    else {
                                        getSvcaccInfo(iamsvcId);
                                        // if (type === "users") {
                                        //     return Modal.createModalWithController('stop.modal.html', {
                                        //         title: 'Permission changed',
                                        //         message: 'For security reasons, if you add or modify permission to yourself, you need to log out and log in again for the added or modified permissions to take effect.'
                                        //       });
                                        // }
                                        if (type === 'AppRolePermission') {
                                            // delete approle
                                        }
                                        var notification = UtilityService.getAParticularSuccessMessage('MESSAGE_SAFE_DELETE');
                                        Notifications.toast(key + "'s permission" + notification);
                                    }
                                }
                                catch (e) {
                                    console.log(e);
                                    $scope.permissionChangeInProgress = false;
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.permissionChangeInProgress = false;
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                $scope.error('md');
                            }
                        },
                        function (error) {
                            // Error handling function
                            console.log(error);
                            $scope.permissionChangeInProgress = false;
                            $scope.isLoadingData = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                            $scope.error('md');
                        })
                } catch (e) {
                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.permissionChangeInProgress = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                }
            }
        }

        $scope.editAWSConfigurationDetails = function (editMode, rolename) {
            if (editMode) {
                try {
                    $scope.isLoadingData = true;
                    var queryParameters = rolename;
                    var updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('getAwsConfigurationDetails', queryParameters);
                    AdminSafesManagement.getAWSConfigurationDetails(null, updatedUrlOfEndPoint).then(
                        function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    $scope.editingAwsPermission = {"status": true};
                                    $scope.awsConfPopupObj = {
                                        "auth_type": response.data.auth_type,
                                        "role": rolename,
                                        "bound_account_id": response.data.bound_account_id,
                                        "bound_region": response.data.bound_region,
                                        "bound_vpc_id": response.data.bound_vpc_id,
                                        "bound_subnet_id": response.data.bound_subnet_id,
                                        "bound_ami_id": response.data.bound_ami_id,
                                        "bound_iam_instance_profile_arn": response.data.bound_iam_instance_profile_arn,
                                        "bound_iam_role_arn": response.data.bound_iam_role_arn,
                                        "policies": response.data.policies,
                                        "bound_iam_principal_arn": response.data.bound_iam_principal_arn,
                                        "resolve_aws_unique_ids": "false"
                                    };
                                    $scope.policies = response.data.policies;
                                    $scope.awsRadioBtn['value'] = $rootScope.AwsPermissionsData.data[rolename];
                                    $scope.open('md');   // open the AWS configuration popup with prefilled data
                                }
                                catch (e) {
                                    console.log(e);
                                    $scope.isLoadingData = false;
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                $scope.error('md');
                            }
                        },
                        function (error) {

                            // Error handling function
                            console.log(error);
                            $scope.isLoadingData = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                            $scope.error('md');

                        })
                } catch (e) {

                    // To handle errors while calling 'fetchData' function
                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');

                }
            }
        }
        var hideUserSudoPolicy = function() {
            $scope.hideSudoPolicy = false;
            var flg = false;
            var count=0;
            Object.keys($scope.permissionData.UsersPermissionsData).forEach(function(key) {
                if ($scope.permissionData.UsersPermissionsData[key] == "sudo") {
                    flg = true;
                }
                count++;
            });
            if (count==1 && flg == true) {
                $scope.hideSudoPolicy = true;
            }
        }

        var getSvcaccInfo = function (svcaccId) {
            $scope.isLoadingData = true;
            $scope.isSvcaccExpired = false;
            $scope.expiredNote = '';
            $scope.iamSecretsData = { "secret": [] };

            var updatedUrlOfEndPoint = RestEndpoints.baseURL + "/v2/iamserviceaccounts/" + svcaccId;
            AdminSafesManagement.getSvcaccOnboardInfo(null, updatedUrlOfEndPoint).then(
                function (response) {
                    if (UtilityService.ifAPIRequestSuccessful(response)) {
                        if ($rootScope.showDetails !== true) {
                            document.getElementById('addUser').value = '';
                            document.getElementById('addGroup').value = '';
                        } 
                        var managedBy = '';
                        lastContent = '';
                        try {
                            $scope.isLoadingData = false;
                            var object = response.data;
                            $scope.svcacc = {
                                appId: object.application_id || '',
                                appName: object.application_name || '',
                                appTag: object.application_tag || '',
                                awsAccId: object.awsAccountId || '',
                                awsAccName: object.awsAccountName || '',
                                ownerEmail: object.owner_email || '',
                                ownerNtId: object.owner_ntid || '',
                                userName: object.userName || '',
                                creationDate: object.createdDate || '',
                                isActivated: object.isActivated || '',
                                svcaccId: object.userName || '',
                            };

                            $scope.iamSecretsData = object.secret;  
                            managedBy = object.owner_email;
            
                            getUserDetails();
                            $scope.permissionData = {
                                UsersPermissionsData: object.users || '',
                                GroupsPermissionsData: object.groups || '',
                                AwsPermissionsData: '',
                                AppRolePermissionsData: ''
                            }
                            $scope.permissionData.AppRolePermissionsData = {
                                "data": object['app-roles']
                            }

                            $scope.permissionData.AwsPermissionsData = {
                                "data": object['aws-roles']
                            }

                            if (object.isActivated){
                                $scope.detailsNavTags[1].show = true;
                            }
                            $scope.isLoadingData = false;
                            hideUserSudoPolicy();
                            getUserDisplayNameDetails();
                        }
                        catch (e) {
                            console.log(e);
                            $scope.isLoadingData = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                            $scope.error('md');
                        }
                    }
                    else {
                        $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                        $scope.error('md');
                    }
                },
                function (error) {
                    console.log(error);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                })                        
            }  
        
        
        $scope.pwdRotationChange = function() {
            $scope.autoRotate = !$scope.autoRotate;
            $scope.svcacc.autoRotate = $scope.autoRotate;
            $scope.svcacc.ttl = '';
        }

        var getUserDisplayNameDetails = function () {
            $scope.isLoadingData = true;
            $scope.userNames = [];
            $scope.UsersPermissionsDetails = [];
            $scope.UsersDisplayNameData = [];
            for (var key in $scope.permissionData.UsersPermissionsData) {
                $scope.userNames.push(key);
            }
            if ($scope.userNames !== undefined && $scope.userNames.length > 0) {
                vaultUtilityService.getAllUsersDataForPermissions($scope.userNames.join()).then(function (res, error) {
                    var serviceData;
                    if (res) {
                        $scope.isLoadingData = false;
                        serviceData = res;
                        $scope.UsersDisplayNameData = serviceData.response.data.data.values;
                        for (var i=0;i<$scope.UsersDisplayNameData.length;i++) {
                            var userNameKey = $scope.UsersDisplayNameData[i].userName.toLowerCase();
                            var userDisplayName = $scope.UsersDisplayNameData[i].displayName + " ("+$scope.UsersDisplayNameData[i].userName+")";
                            var permissionVal = "";
                            for (var key in $scope.permissionData.UsersPermissionsData) {
                                if(key.toLowerCase() === userNameKey) {
                                    permissionVal = $scope.permissionData.UsersPermissionsData[key.toLowerCase()];
                                }
                            }
                            $scope.UsersPermissionsDetails.push({"key":userNameKey, "value":permissionVal, "displayName":userDisplayName});
                        }
                        $scope.$apply();
                    } else {
                        $scope.isLoadingData = false;
                        serviceData = error;
                        $scope.commonErrorHandler(serviceData.error, serviceData.error || serviceData.response.data, "getDropdownData");

                    }
                },
                function (error) {
                    $scope.isLoadingData = false;
                    // Error handling function when api fails
                    $scope.showInputLoader.show = false;
                    if (error.status === 500) {
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_NETWORK');
                        $scope.error('md');
                    } else if(error.status !== 200 && (error.xhrStatus === 'error' || error.xhrStatus === 'complete')) {
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_AUTOCOMPLETE_USERNAME');
                        $scope.error('md');
                    }
                });
            }else{
                $scope.isLoadingData = false;
            }
        }

        $scope.requestDataFrChangeSvcacc = function () {
            $scope.isLoadingData = true;
            if ($stateParams.svcaccData) {
                // Prefilled values when editing
                $scope.changeSvcaccHeader = "EDIT IAM SERVICE ACCOUNT";
                $scope.isEditSvcacc = true;
                try {
                    getSvcaccInfo($stateParams.svcaccData.userId);
                } catch (e) {
                    // To handle errors while calling 'fetchData' function
                    if ($rootScope.showDetails !== true) {
                        document.getElementById('addUser').value = '';
                        document.getElementById('addGroup').value = '';
                    }
                    console.log(e);
                    $scope.isLoadingData = false;
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                }

            }
            else {
                if (JSON.parse(SessionStore.getItem("isAdmin")) == false) {
                    $state.go('manage');
                }
                else {
                    $state.go('admin');
                }
            }
        }

        $scope.getSvcaccInfo = function (svcaccObj) {
            $scope.svcacc = svcaccObj;
            $scope.svcacc.svcaccId = svcaccObj.userId;  
            $scope.svcacc.accountExpires = $scope.svcacc.accountExpiresFormatted;
            $scope.svcInputSelected = true;
            $scope.isCollapsed = false;
            $scope.autoRotate = false;
            document.getElementById('ttl').placeholder="TTL in seconds (Max: "+$scope.svcacc.maxPwdAge+")";
            $scope.isSvcaccExpired = false;
            $scope.expiredNote = "";
            if ($scope.svcacc.accountStatus.toLowerCase() == "expired") {
                $scope.isSvcaccExpired = true;
                $scope.expiredNote = "(Expired)";
            }
            getDefaultTTL();
            getUserDetails();
        }

        // $scope.collapseADDetails = function() {
        //     $scope.isCollapsed = !$scope.isCollapsed;          
        // }
        
        $scope.clearSvcaccId = function() {
            $scope.svcacc = {
                svcaccId: '',
                userEmail: '',
                displayName: '',
                givenName: '',
                userName: '',
                accountExpires: '',
                pwdLastSet: '',
                maxPwdAge: '',
                managedBy: {},
                passwordExpiry: '',
                accountStatus: '',
                lockStatus: '',
                creationDate: '',
                purpose: '',
                autoRotate: false,
                ttl: '' ,
                max_ttl: '',
                adGroup: '',
                appName: '',
            };
            $scope.autoRotate = false;
            $scope.svcInputSelected = false;
            $scope.isCollapsed = true;
            document.getElementById('ttl').placeholder="Password TTL in seconds";
            $scope.expiredNote = "";
            $scope.isSvcaccExpired = false;
            $scope.ttlToolip = '';
            $scope.defatulTTL = '';
            $scope.customTTL = '';
            $scope.isOwner = false;
            $scope.ownerName = '';
            $scope.ownerEmail = '';
            $scope.svceditnotes = '';
            $scope.isActivating = false;
            $scope.appNameSelected = false;
            $scope.isApplicationsLoading = true;
            $scope.applicationName = '';
        }

        $scope.getSvcaccList = function(searchVal) {
            $scope.svcInputSelected = false;
            if (searchVal.length >2) {
                $scope.showInputLoader.show = true;
                console.log("getServiceAccounts")
                var queryParameters = "serviceAccountName=" + searchVal;
                var updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('getServiceAccounts', queryParameters);
                return AdminSafesManagement.getServiceAccounts(null, updatedUrlOfEndPoint).then(
                    function(response) {
                        if(UtilityService.ifAPIRequestSuccessful(response)){
                            $scope.svcaccList = response.data.data.values;
                            $scope.showInputLoader.show = false;
                            return orderByFilter(filterFilter($scope.svcaccList, searchVal), 'userId', true);
                        }
                        else {
                            $scope.showInputLoader.show = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                            $scope.error('md');
                        }
                    },
                    function(error) {
                        // Error handling function
                        console.log(error);
                        $scope.showInputLoader.show = false;
                        $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                        $scope.error('md');
                });
            }
        }

        $scope.init = function () {
            if(!SessionStore.getItem("myVaultKey")){ /* Check if user is in the same session */
                $state.go('/');
                return;
            }
            var feature = JSON.parse(SessionStore.getItem("feature"));
            if (feature.adpwdrotation == false) {
                if (JSON.parse(SessionStore.getItem("isAdmin")) == false) {
                    $state.go('manage');
                }
                else {
                    $state.go('admin');
                }
            }
            $scope.svcacc = {
                svcaccId: '',
                userEmail: '',
                displayName: '',
                givenName: '',
                userName: '',
                accountExpires: '',
                pwdLastSet: '',
                maxPwdAge: '',
                managedBy: {},
                passwordExpiry: '',
                accountStatus: '',
                lockStatus: '',
                creationDate: '',               
                purpose: '',
                autoRotate: false,
                ttl: '' ,    
                max_ttl: '',
                adGroup: '',
                appName: '',
            };
            $scope.permissionData = {
                UsersPermissionsData: '',
                GroupsPermissionsData: '',
                AwsPermissionsData: '',
                AppRolePermissionsData: ''
            }
            $scope.newPassword = '';
            $scope.hideSudoPolicy = false;
            $scope.ttlToolip = '';
            $scope.defatulTTL = '';
            $scope.ownerName = '';
            $scope.ownerEmail = '';
            $scope.customTTL = '';
            $scope.isOwner = false;
            $scope.svceditnotes = '';
            $scope.permissionChangeInProgress = false;
            $scope.isActivating = false;
            $scope.adGroupName = '';
            $scope.appNameSelected = false;
            $scope.applicationName = '';
            $scope.isApplicationsLoading = true;

            $scope.disableAddBtn = true;
            $scope.userAutoCompleteEnabled = false;
            $scope.groupAutoCompleteEnabled = false;
            if (AppConstant.AD_USERS_AUTOCOMPLETE == true) {
                $scope.userAutoCompleteEnabled = true;
            }
            if (AppConstant.AD_GROUP_AUTOCOMPLETE == true) {
                $scope.groupAutoCompleteEnabled = true;
            }
            $scope.myVaultKey = SessionStore.getItem("myVaultKey");
            if(!$scope.myVaultKey){ /* Check if user is in the same session */
                $state.go('/');
            }
            $scope.appNameTableOptions = [];
            $scope.requestDataFrChangeSvcacc();
            $scope.fetchUsers();
            $scope.fetchGroups();
        }

        var getWorkloadDetails = function () {
            $scope.isApplicationsLoading = true;
            AdminSafesManagement.getApprolesFromCwm().then(function (response) {
                if (UtilityService.ifAPIRequestSuccessful(response)) {
                    $scope.isApplicationsLoading = false;
                    var data = response.data;
                    $scope.appNameTableOptions = [];
                     for (var index = 0;index<data.length;index++) {
                        var value = '';
                        var appTag = '';
                        var appID = '';
                        var name = '';
                        if (data[index].appName !='' && data[index].appName != null && data[index].appName != undefined) {
                            value = data[index].appName;
                            name = value;
                        }
                        if (data[index].appID !='' && data[index].appID != null && data[index].appID != undefined) {
                            appID = data[index].appID;
                        }
                        if (data[index].appTag !='' && data[index].appTag != null && data[index].appTag != undefined) {
                            appTag = data[index].appTag;
                        }
                        value = value + " (AppID: "+ appID + ", AppTag: " + appTag + ")";
                        $scope.appNameTableOptions.push({"type":value, "name": name, "tag": appTag, "id": appID});
                    }
                    if ($scope.applicationName =="" || $scope.applicationName ==null || $scope.applicationName == undefined) {
                        document.getElementById('applicationName').value = '';
                        document.getElementById('applicationName').placeholder="Search application name";
                    }
                }
                else {
                    $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                    $scope.error('md');
                }
            },
            function (error) {
                // Error handling function
                console.log(error);
                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                $scope.error('md');
            })
        }

        $scope.getAppName = function (searchName) {
            return orderByFilter(filterFilter($scope.appNameTableOptions, searchName), 'name', true);
        }
        $scope.userNameValEmpty = false;
        $scope.grpNameValEmpty = false;

        $scope.fetchUsers = function () {

        }

        $scope.fetchGroups = function () {

        }
        $scope.enableEc2Controls = function (e) {
            angular.element(document.getElementById('bound_account_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_region'))[0].disabled = false;
            angular.element(document.getElementById('bound_vpc_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_subnet_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_ami_id'))[0].disabled = false;
            angular.element(document.getElementById('bound_iam_instance_profile_arn'))[0].disabled = false;
            angular.element(document.getElementById('bound_iam_role_arn'))[0].disabled = false;
            angular.element(document.getElementById('bound_iam_principal_arn'))[0].disabled = true;
        }

        $scope.enableIamControls = function (e) {
            angular.element(document.getElementById('bound_account_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_region'))[0].disabled = true;
            angular.element(document.getElementById('bound_vpc_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_subnet_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_ami_id'))[0].disabled = true;
            angular.element(document.getElementById('bound_iam_instance_profile_arn'))[0].disabled = true;
            angular.element(document.getElementById('bound_iam_role_arn'))[0].disabled = true;
            angular.element(document.getElementById('bound_iam_principal_arn'))[0].disabled = false;
        }

        $scope.addPermission = function (type, key, permission, editingPermission) {
            var duplicate = false;
            if (key !== null && key !== undefined) {
                if (type === "users" && !editingPermission) {
                    key = document.getElementById('addUser').value.toLowerCase();
                }
                if (type === "groups" && !editingPermission) {
                    key = document.getElementById('addGroup').value;
                }
                // extract only userId/groupId from key
                if (key.includes($scope.domainName)) {
                    key = key.split('@')[0];
                }
                if (type === "users" && key.includes("(")) {
                    key = key.substring(key.lastIndexOf("(") + 1, key.lastIndexOf(")"));
                }
            }
            $scope.permissionChangeInProgress = true;
            if (!editingPermission && key != '' && key != undefined) {
                if (type === "users" && $scope.permissionData.UsersPermissionsData!= null && $scope.permissionData.UsersPermissionsData.hasOwnProperty(key.toLowerCase())) {
                    if ($scope.permissionData.UsersPermissionsData[key.toLowerCase()] != "sudo") {
                        duplicate = true;
                    }
                }
                if (type === "groups" && $scope.permissionData.GroupsPermissionsData!= null) {
                    var groupIndex = Object.keys($scope.permissionData.GroupsPermissionsData).findIndex(function (groupName) {
                        return groupName.toLowerCase() === key.toLowerCase();
                    });
                    if(groupIndex > -1) {
                        duplicate = true;
                    }
                }
                if (type === "AWSPermission" && $scope.permissionData.AwsPermissionsData.data!= null && $scope.permissionData.AwsPermissionsData.data.hasOwnProperty(key.toLowerCase())) {
                    duplicate = true;
                }
                if (type === "AppRolePermission" && $scope.permissionData.AppRolePermissionsData.data!= null && $scope.permissionData.AppRolePermissionsData.data.hasOwnProperty(key.toLowerCase())) {
                    duplicate = true;
                }
            }
            if (duplicate) {
                clearInputPermissionData();
                $scope.errorMessage = 'Permission already exists! Select edit icon for update';
                $scope.error('md');
            }
            else if (key != '' && key != undefined) {
                try {
                    Modal.close('');
                    $scope.isLoadingData = true;
                    $scope.showInputLoader.show = false;
                    $scope.showNoMatchingResults = false;
                    var iamSvcaccName = $scope.svcacc.svcaccId;
                    var apiCallFunction = '';
                    var reqObjtobeSent = {};
                    var updatedUrlOfEndPoint = "";
                    switch (type) {
                        case 'users' :
                            apiCallFunction = AdminSafesManagement.addUserPermissionForIAMSvcacc;
                            reqObjtobeSent = {"iamSvcAccName": iamSvcaccName,"awsAccountId": $scope.svcacc.awsAccId, "username": key, "access": permission.toLowerCase()};
                            if (SessionStore.getItem("username") == key) {
                                $scope.isLoadingData = false;
                                clearInputPermissionData();
                                $scope.errorMessage = "Owner permission for an IAM service account cannot be changed!";
                                $scope.error('md');
                                getSvcaccInfo($scope.svcacc.awsAccId + "_" +iamSvcaccName);
                                return;
                            }
                            break;
                        case 'groups' :
                            apiCallFunction = AdminSafesManagement.addGroupPermissionForIAMSvcacc;
                            reqObjtobeSent = {"iamSvcAccName": iamSvcaccName, "groupname": key, "access": permission.toLowerCase(), "awsAccountId":$scope.svcacc.awsAccId};
                            break;
                        case 'AWSPermission':
                            apiCallFunction = AdminSafesManagement.addAWSPermissionForIAMSvcacc;
                            reqObjtobeSent = { "iamSvcAccName": iamSvcaccName, "rolename": key, "access": permission.toLowerCase(), "awsAccountId":$scope.svcacc.awsAccId };
                            break;
                        case 'AwsRoleConfigure':
                            $scope.awsConfPopupObj['policies'] = "";   // Todo: Because of unavailability of edit service, this has been put
                            // Validate the input here if requried...
                            if ($scope.awsConfPopupObj.auth_type === 'ec2') {
                                $scope.awsConfPopupObj.bound_iam_principal_arn = "";
                                apiCallFunction = AdminSafesManagement.createAwsRoleIAMSvcacc;
                            }
                            else {
                                $scope.awsConfPopupObj['policies'] = [];
                                $scope.awsConfPopupObj.bound_account_id = "";
                                $scope.awsConfPopupObj.bound_region = "";
                                $scope.awsConfPopupObj.bound_vpc_id = "";
                                $scope.awsConfPopupObj.bound_subnet_id = "";
                                $scope.awsConfPopupObj.bound_ami_id = "";
                                $scope.awsConfPopupObj.bound_iam_instance_profile_arn = "";
                                $scope.awsConfPopupObj.bound_iam_role_arn = "";
                                var arn = [];
                                arn.push($scope.awsConfPopupObj.bound_iam_principal_arn);
                                $scope.awsConfPopupObj.bound_iam_principal_arn = arn;
                                apiCallFunction = AdminSafesManagement.createAwsIAMRoleIAMSvcacc;
                            }
                            reqObjtobeSent = $scope.awsConfPopupObj
                            break;    
                        case 'AppRolePermission':
                            apiCallFunction = AdminSafesManagement.addAppRolePermissionForIAMSvcacc;
                            reqObjtobeSent = { "iamSvcAccName": iamSvcaccName, "approlename": key, "access": permission.toLowerCase(), "awsAccountId":$scope.svcacc.awsAccId};
                            break;    
                    }
                    apiCallFunction(reqObjtobeSent, updatedUrlOfEndPoint).then(function (response) {
                            if (UtilityService.ifAPIRequestSuccessful(response)) {
                                // Try-Catch block to catch errors if there is any change in object structure in the response
                                try {
                                    $scope.isLoadingData = false;
                                    var uniqueIAMSvcName = $scope.svcacc.awsAccId + "_" +iamSvcaccName;
                                    if (type === 'AwsRoleConfigure') {
                                        $scope.addPermission('AWSPermission', $scope.awsConfPopupObj.role, permission, false);
                                    }
                                    else {
                                    getSvcaccInfo(uniqueIAMSvcName);
                                    var notification = UtilityService.getAParticularSuccessMessage('MESSAGE_ADD_SUCCESS');
                                    $scope.permissionChangeInProgress = false;
                                    if (key !== null && key !== undefined) {
                                        document.getElementById('addUser').value = '';
                                        document.getElementById('addGroup').value = '';
                                        clearInputPermissionData();
                                        Notifications.toast(key + "'s permission" + notification);
                                    }
                                }
                                } catch (e) {
                                    console.log(e);
                                    $scope.isLoadingData = false;
                                    $scope.permissionChangeInProgress = false;
                                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_PROCESSING_DATA');
                                    $scope.error('md');
                                }
                            }
                            else {
                                $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                                $scope.error('md');
                            }
                            clearInputPermissionData();
                            $scope.roleNameSelected = false;
                        },
                        function (error) {
                            // Error handling function
                            console.log(error);
                            clearInputPermissionData();
                            $scope.isLoadingData = false;
                            $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                            $scope.error('md');
                        })
                } catch (e) {
                    // To handle errors while calling 'fetchData' function
                    $scope.isLoadingData = false;
                    clearInputPermissionData();
                    console.log(e);
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                }
            }
        }

        $scope.newAwsConfiguration = function (size) {
            // To reset the aws configuration details object to create a new one
            $scope.editingAwsPermission = {"status": false};
            $scope.awsConfPopupObj = {
                "auth_type":"",
                "role": "",
                "bound_account_id": "",
                "bound_region": "",
                "bound_vpc_id": "",
                "bound_subnet_id": "",
                "bound_ami_id": "",
                "bound_iam_instance_profile_arn": "",
                "bound_iam_role_arn": "",
                "policies": "",
                "bound_iam_principal_arn": "",
                "resolve_aws_unique_ids": "false"
            };
            $scope.open(size);
        }


        //APPROLE FUNCTION:
        $scope.addApproleToSafe = function (size) {
            // To reset the aws configuration details object to create a new one
            $scope.editingApprolePermission = {"status": false};
            $scope.approleConfPopupObj = {
                "token_max_ttl":"",
                "token_ttl": "",
                "role_name": "",
                "policies": "",
                "bind_secret_id": "",
                "secret_id_num_uses": "",
                "secret_id_ttl": "",
                "token_num_uses": ""
            };
            $scope.roleNameSelected = false;
            $scope.roleNameTableOptions = [];
            AdminSafesManagement.getApproles().then(function (response) {
                if (UtilityService.ifAPIRequestSuccessful(response)) {
                    var keys = response.data.keys +'';
                    var roles = keys.split(',');
                    for (var index = 0;index<roles.length;index++) {
                        $scope.roleNameTableOptions.push({"type":roles[index]});
                    }
                }
                else {
                    $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                    $scope.error('md');
                }
            },
            function (error) {
                // Error handling function
                console.log(error);
                $scope.isLoadingData = false;
                $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                $scope.error('md');
            })

            $scope.dropDownRoleNames = {
                'selectedGroupOption': {"type": "Select Role Name"},       // As initial placeholder
                'tableOptions': $scope.roleNameTableOptions
            }
            $scope.openApprole(size);
        }

        /* TODO: What is open, functon name should be more descriptive */
        $scope.open = function (size) {
            Modal.createModal(size, 'changeSafePopup.html', 'ChangeIamServiceAccountCtrl', $scope);
        };

        /* TODO: What is open, functon name should be more descriptive */
        $scope.openApprole = function (size) {
            Modal.createModal(size, 'appRolePopup.html', 'ChangeIamServiceAccountCtrl', $scope);
        };
//
        $scope.openActivationStatus = function (size) {
            Modal.createModal(size, 'openActivationStatus.html', 'ChangeIamServiceAccountCtrl', $scope);
        }
//
        $scope.openOneTimeResetFailedMessage = function (size) {
            Modal.createModal(size, 'openOneTimeResetFailedMessage.html', 'ChangeIamServiceAccountCtrl', $scope);
        };
//
        $scope.iamActivationConfirmation = function (size) {
            Modal.createModal(size, 'iamActivationConfirmation.html', 'ChangeIamServiceAccountCtrl', $scope);
        }
        
        /* TODO: What is ok, functon name should be more descriptive */
        $scope.ok = function () {
            Modal.close('ok');
            $scope.isLoadingData = false;
        };

        /* TODO: What is next, functon name should be more descriptive */
        $scope.next = function () {
            $scope.addAWSRoleSafe();
            // $scope.openAWSConfFinal('md');

        };

        /* TODO: What is cancel, functon name should be more descriptive */
        $scope.cancel = function () {
            Modal.close('close');
            $scope.isLoadingData = false;
        };

        $scope.onboardingDone = function () {
            Modal.close('close');
            if ($scope.isLoadingData == true) {
                Notifications.toast("Loading Service Account Details..");
            }
        }

        var getUserDetails = function () {
            $scope.ownerName = $scope.svcacc.userName;
            $scope.ownerEmail = $scope.svcacc.owner_email;
        }

        $scope.grantPermission = function (svcaccname)  {
            //getMetadata(svcaccname);
            $rootScope.showDetails = false;
            $rootScope.activeDetailsTab = 'permissions';
        }

        $scope.activateIAM = function () {
            $scope.isLoadingData = true;
            $scope.isActivating = true;
            Modal.close();
            Notifications.toast('Activating Service account. Please wait..');
            var queryParameters = "serviceAccountName=" + $scope.svcacc.svcaccId + "&awsAccountId=" + $scope.svcacc.awsAccId;
            var updatedUrlOfEndPoint = ModifyUrl.addUrlParameteres('activateIAMSvcacc',queryParameters);
            AdminSafesManagement.activateIAMSvcacc(null, updatedUrlOfEndPoint).then(function (response) {
                if (UtilityService.ifAPIRequestSuccessful(response)) {
                    $scope.isLoadingData = false;
                    $scope.newPassword = response.data.current_password;
                    $scope.resetMessage = "IAM Service account "+$scope.svcacc.svcaccId+" has been activated successfully!"
                    $scope.initialPwdResetRequired = false;
                    $scope.detailsNavTags[1].show = true;
                    $scope.isActivating = false;
                    $scope.svcacc.isActivated = true;
                    var uniqueIAMSvcName = $scope.svcacc.awsAccId + "_" + $scope.svcacc.svcaccId;
                    getSvcaccInfo(uniqueIAMSvcName);
                    $scope.openActivationStatus();
                }
                else {
                    $scope.isLoadingData = false;
                    $scope.isActivating = false;
                    $scope.newPassword = '';
                    $scope.errorMessage = AdminSafesManagement.getTheRightErrorMessage(response);
                    error('md');
                }
            },
            function (error) {
                // Error handling function
                console.log(error);
                $scope.isLoadingData = false;
                $scope.isActivating = false;
                if (error.status === '403' || error.status === 403) {
                    $scope.openOneTimeResetFailedMessage();
                }
                else {
                    $scope.errorMessage = UtilityService.getAParticularErrorMessage('ERROR_GENERAL');
                    $scope.error('md');
                }
            });
        }

        $scope.init();

    });
})(angular.module('vault.features.ChangeIamServiceAccountCtrl', [
    'vault.services.AdminSafesManagement',
    'vault.services.ModifyUrl',
    'vault.constants.AppConstant'
]));
