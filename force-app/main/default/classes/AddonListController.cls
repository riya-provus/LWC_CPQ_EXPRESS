public with sharing class AddonListController {
    
    @AuraEnabled(cacheable=true)
    public static List<CPQ_Addon__c> getAddons() {
        try {
            return [
                SELECT Id, Name, Addon_ID__c, Description__c, Billing_Unit__c, 
                       Price__c, Cost__c, Tags__c, Active__c, City__c, State__c, 
                       Country__c, Location__c, CreatedDate
                FROM CPQ_Addon__c
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static CPQ_Addon__c createAddon(String name, String description, String billingUnit, 
                                           Decimal price, Decimal cost, String tags, Boolean active,
                                           String city, String state, String country, String location) {
        try {
            CPQ_Addon__c newAddon = new CPQ_Addon__c(
                Name = name,
                Description__c = description,
                Billing_Unit__c = billingUnit,
                Price__c = price,
                Cost__c = cost,
                Tags__c = tags,
                Active__c = active,
                City__c = city,
                State__c = state,
                Country__c = country,
                Location__c = location
            );
            insert newAddon;
            
            // Re-query to get the auto-number ID
            return [SELECT Id, Name, Addon_ID__c, Description__c, Billing_Unit__c, 
                           Price__c, Cost__c, Tags__c, Active__c, City__c, State__c, 
                           Country__c, Location__c
                    FROM CPQ_Addon__c WHERE Id = :newAddon.Id];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteAddon(Id addonId) {
        try {
            delete [SELECT Id FROM CPQ_Addon__c WHERE Id = :addonId];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void toggleAddonActive(Id addonId, Boolean active) {
        try {
            CPQ_Addon__c addon = [SELECT Id FROM CPQ_Addon__c WHERE Id = :addonId];
            addon.Active__c = active;
            update addon;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
