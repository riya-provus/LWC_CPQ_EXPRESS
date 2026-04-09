public with sharing class ResourceRoleController {
    
    @AuraEnabled(cacheable=true)
    public static List<Resource_Role__c> getResourceRoles() {
        try {
            return [
                SELECT Id, Name, Role_ID__c, Location__c, Billing_Unit__c, Price__c, Cost__c, Active__c, 
                       Description__c, City__c, State__c, Country__c 
                FROM Resource_Role__c 
                ORDER BY Name ASC 
                LIMIT 100
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching resource roles: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Resource_Role__c createResourceRole(String name, String description, Decimal price, Decimal cost, String billingUnit, String city, String state, String country, Boolean active) {
        try {
            Resource_Role__c role = new Resource_Role__c(
                Name = name,
                Description__c = description,
                Price__c = price,
                Cost__c = cost,
                Billing_Unit__c = billingUnit,
                City__c = city,
                State__c = state,
                Country__c = country,
                Active__c = active
            );
            insert role;
            return role;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating resource role: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateResourceRole(Id roleId, String name, String description, Decimal price, Decimal cost, String billingUnit, String city, String state, String country, Boolean active) {
        try {
            update new Resource_Role__c(
                Id = roleId,
                Name = name,
                Description__c = description,
                Price__c = price,
                Cost__c = cost,
                Billing_Unit__c = billingUnit,
                City__c = city,
                State__c = state,
                Country__c = country,
                Active__c = active
            );
        } catch (Exception e) {
            throw new AuraHandledException('Error updating resource role: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteResourceRole(Id roleId) {
        try {
            delete [SELECT Id FROM Resource_Role__c WHERE Id = :roleId];
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting resource role: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void toggleResourceRoleActive(Id roleId, Boolean active) {
        try {
            Resource_Role__c role = new Resource_Role__c(Id = roleId, Active__c = active);
            update role;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating resource role status: ' + e.getMessage());
        }
    }
}
