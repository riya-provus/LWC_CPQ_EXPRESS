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
    public static CPQ_Product__c createProduct(CPQ_Product__c product) {
        try {
            insert product;
            return [SELECT Id, Name, Product_ID__c, Description__c, Billing_Unit__c, 
                           Price__c, Cost__c, Tags__c, Active__c, City__c, State__c, 
                           Country__c, Location__c
                    FROM CPQ_Product__c WHERE Id = :product.Id];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateProduct(CPQ_Product__c product) {
        try {
            update product;
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
