public with sharing class CPQAdminController {

    // ─────────────────────────────────────────────────────────────
    // COMPANY INFO & PDF SETTINGS  (stored in CPQ_Settings__c)
    // ─────────────────────────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static CPQ_Settings__c getSettings() {
        List<CPQ_Settings__c> settings = [
            SELECT Id, Name,
                   Company_Name__c, Company_Email__c, Company_Phone__c,
                   Company_Website__c, Company_Address__c, Company_City__c,
                   Company_State__c, Company_Zip__c, Company_Country__c, Brand_Logo_URL__c,
                   PDF_Format__c, PDF_Round_Values__c, PDF_Decimal_Places__c,
                   PDF_Show_Discount__c, PDF_Detailed_Line_Items__c,
                   PDF_Footer_Text__c, PDF_Section_Layout__c
            FROM CPQ_Settings__c
            ORDER BY CreatedDate ASC
            LIMIT 1
        ];

        if (!settings.isEmpty()) {
            return settings[0];
        }

        // Auto-create a default record if none exists
        CPQ_Settings__c def = new CPQ_Settings__c(
            Name = 'Default',
            PDF_Format__c = 'Standard',
            PDF_Round_Values__c = true,
            PDF_Decimal_Places__c = 2,
            PDF_Show_Discount__c = true,
            PDF_Detailed_Line_Items__c = true,
            PDF_Section_Layout__c = '[{"id":"header","label":"Header","visible":true},{"id":"billTo","label":"Bill to","visible":true},{"id":"projectOverview","label":"Project overview","visible":true},{"id":"priceBreakdown","label":"Price breakdown","visible":true},{"id":"summary","label":"Summary","visible":true},{"id":"milestones","label":"Milestones","visible":true},{"id":"termsAndConditions","label":"Terms and conditions","visible":true}]'
        );
        insert def;
        return def;
    }

    @AuraEnabled
    public static void saveSettings(String settingsJson) {
        try {
            Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(settingsJson);

            CPQ_Settings__c rec;
            List<CPQ_Settings__c> existing = [SELECT Id FROM CPQ_Settings__c ORDER BY CreatedDate ASC LIMIT 1];
            if (!existing.isEmpty()) {
                rec = new CPQ_Settings__c(Id = existing[0].Id);
            } else {
                rec = new CPQ_Settings__c(Name = 'Default');
            }

            if (data.containsKey('companyName'))          rec.Company_Name__c           = (String) data.get('companyName');
            if (data.containsKey('companyEmail'))         rec.Company_Email__c          = (String) data.get('companyEmail');
            if (data.containsKey('companyPhone'))         rec.Company_Phone__c          = (String) data.get('companyPhone');
            if (data.containsKey('companyWebsite'))       rec.Company_Website__c        = (String) data.get('companyWebsite');
            if (data.containsKey('companyAddress'))       rec.Company_Address__c        = (String) data.get('companyAddress');
            if (data.containsKey('companyCity'))          rec.Company_City__c           = (String) data.get('companyCity');
            if (data.containsKey('companyState'))         rec.Company_State__c          = (String) data.get('companyState');
            if (data.containsKey('companyZip'))           rec.Company_Zip__c            = (String) data.get('companyZip');
            if (data.containsKey('companyCountry'))       rec.Company_Country__c        = (String) data.get('companyCountry');
            if (data.containsKey('brandLogoUrl'))         rec.Brand_Logo_URL__c         = (String) data.get('brandLogoUrl');

            if (data.containsKey('pdfFormat'))            rec.PDF_Format__c             = (String) data.get('pdfFormat');
            if (data.containsKey('pdfRoundValues'))       rec.PDF_Round_Values__c       = (Boolean) data.get('pdfRoundValues');
            if (data.containsKey('pdfDecimalPlaces'))     rec.PDF_Decimal_Places__c     = Decimal.valueOf(String.valueOf(data.get('pdfDecimalPlaces')));
            if (data.containsKey('pdfShowDiscount'))      rec.PDF_Show_Discount__c      = (Boolean) data.get('pdfShowDiscount');
            if (data.containsKey('pdfDetailedLineItems')) rec.PDF_Detailed_Line_Items__c = (Boolean) data.get('pdfDetailedLineItems');
            if (data.containsKey('pdfFooterText'))        rec.PDF_Footer_Text__c        = (String) data.get('pdfFooterText');
            if (data.containsKey('pdfSectionLayout'))     rec.PDF_Section_Layout__c     = (String) data.get('pdfSectionLayout');

            upsert rec;
        } catch (Exception e) {
            throw new AuraHandledException('Save failed: ' + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────
    // TEAM / USERS
    // ─────────────────────────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getTeamData() {
        Map<String, Object> result = new Map<String, Object>();
        try {
            Integer totalSeats = 5;
            Integer usedSeats  = [SELECT COUNT() FROM User WHERE IsActive = true AND Profile.UserLicense.LicenseDefinitionKey = 'SFDC'];

            result.put('totalSeats',     totalSeats);
            result.put('usedSeats',      usedSeats);
            result.put('availableSeats', totalSeats - usedSeats);

            // Fetch active users
            List<User> users = [
                SELECT Id, FirstName, LastName, Name, Email, Username,
                       IsActive, LastLoginDate, UserRole.Name,
                       Profile.Name, CPQ_Role__c
                FROM User
                WHERE Profile.UserLicense.LicenseDefinitionKey = 'SFDC'
                ORDER BY IsActive DESC, LastLoginDate DESC NULLS LAST
                LIMIT 200
            ];

            List<Map<String, Object>> userList = new List<Map<String, Object>>();
            for (User u : users) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('id',         u.Id);
                m.put('name',       u.Name);
                m.put('firstName',  u.FirstName);
                m.put('lastName',   u.LastName);
                m.put('email',      u.Email);
                m.put('username',   u.Username);
                m.put('isActive',   u.IsActive);
                String pName = u.Profile.Name;
                String roleLbl = 'User';
                if (pName == 'System Administrator') {
                    roleLbl = 'Admin';
                } else if (pName == 'CPQ_Manager') {
                    roleLbl = 'Manager';
                } else if (pName == 'CPQ_User') {
                    roleLbl = 'User';
                } else {
                    roleLbl = u.CPQ_Role__c != null ? u.CPQ_Role__c : 'User';
                }
                m.put('role', roleLbl);
                m.put('lastLogin',  u.LastLoginDate != null ? u.LastLoginDate : null);
                m.put('initials',   getInitials(u.FirstName, u.LastName));
                
                // Status logic: if active but no login dates => Pending
                String finalStatus = u.IsActive ? (u.LastLoginDate == null ? 'Pending' : 'Active') : 'Inactive';
                m.put('status',     finalStatus);
                
                userList.add(m);
            }
            result.put('users', userList);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static String createTeamMember(String firstName, String lastName,
                                          String email, String username, String cpqRole) {
        try {
            // Map the CPQ Role to the corresponding Profile Name
            String profileName;
            if (cpqRole == 'Admin') {
                profileName = 'System Administrator';
            } else {
                profileName = 'CPQ_' + cpqRole; // Expected: CPQ_User or CPQ_Manager
            }
            
            Profile p = [SELECT Id FROM Profile WHERE Name = :profileName LIMIT 1];

            User newUser = new User(
                FirstName        = firstName,
                LastName         = lastName,
                Email            = email,
                Username         = String.isBlank(username) ? email : username,
                Alias            = (firstName.left(1) + (lastName.length() >= 4 ? lastName.left(4) : lastName)).toLowerCase(),
                EmailEncodingKey = 'UTF-8',
                LanguageLocaleKey= 'en_US',
                LocaleSidKey     = 'en_US',
                TimeZoneSidKey   = 'America/Los_Angeles',
                ProfileId        = p.Id,
                CPQ_Role__c      = cpqRole,
                IsActive         = true
            );
            insert newUser;

            // ─── Auto-Assign Permission Sets ──────────────────────────
            String permSetName = (cpqRole == 'Manager' || cpqRole == 'Admin') ? 'CPQ_Manager_Access' : 'CPQ_User_Access';
            
            List<PermissionSet> psList = [SELECT Id FROM PermissionSet WHERE Name = :permSetName LIMIT 1];
            if (!psList.isEmpty()) {
                insert new PermissionSetAssignment(
                    AssigneeId = newUser.Id,
                    PermissionSetId = psList[0].Id
                );
            }

            // Send standard reset-password email (which prompts them to set password on first login)
            System.resetPassword(newUser.Id, true);

            return newUser.Id;
        } catch (Exception e) {
            throw new AuraHandledException('User creation failed: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateUserRole(String userId, String newRole) {
        try {
            update new User(Id = userId, CPQ_Role__c = newRole);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void toggleUserStatus(String userId, Boolean isActive) {
        try {
            update new User(Id = userId, IsActive = isActive);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static String getCurrentUserRole() {
        User curr = [SELECT CPQ_Role__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        return curr.CPQ_Role__c != null ? curr.CPQ_Role__c : 'User';
    }

    private static String getInitials(String first, String last) {
        String f = (first  != null && first.length()  > 0) ? first.left(1).toUpperCase()  : '';
        String l = (last   != null && last.length()   > 0) ? last.left(1).toUpperCase()   : '';
        return f + l;
    }
}
