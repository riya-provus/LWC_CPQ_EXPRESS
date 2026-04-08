public with sharing class ProductListController {
    
    @AuraEnabled(cacheable=true)
    public static List<CPQ_Product__c> getProducts() {
        try {
            return [
                SELECT Id, Name, Product_ID__c, Description__c, Billing_Unit__c, 
                       Price__c, Cost__c, Tags__c, Active__c, City__c, State__c, 
                       Country__c, Location__c, CreatedDate
                FROM CPQ_Product__c
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static CPQ_Product__c createProduct(String name, String description, String billingUnit, 
                                             Decimal price, Decimal cost, String tags, Boolean active,
                                             String city, String state, String country, String location) {
        try {
            CPQ_Product__c newProd = new CPQ_Product__c(
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
            insert newProd;
            
            // Re-query to get the auto-number ID
            return [SELECT Id, Name, Product_ID__c, Description__c, Billing_Unit__c, 
                           Price__c, Cost__c, Tags__c, Active__c, City__c, State__c, 
                           Country__c, Location__c
                    FROM CPQ_Product__c WHERE Id = :newProd.Id];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteProduct(Id productId) {
        try {
            delete [SELECT Id FROM CPQ_Product__c WHERE Id = :productId];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void toggleProductActive(Id productId, Boolean active) {
        try {
            CPQ_Product__c prod = [SELECT Id FROM CPQ_Product__c WHERE Id = :productId];
            prod.Active__c = active;
            update prod;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
