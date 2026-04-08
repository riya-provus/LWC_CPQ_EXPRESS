public with sharing class AccountListController {
    
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccountsDetailed() {
        try {
            return [
                SELECT Id, Name, AccountNumber, Type, Industry, Website, Phone 
                FROM Account 
                ORDER BY Name ASC 
                LIMIT 100
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching accounts: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, List<String>> getAccountFilters() {
        Map<String, List<String>> filters = new Map<String, List<String>>();
        
        // Type picklist values
        List<String> types = new List<String>();
        Schema.DescribeFieldResult typeResult = Account.Type.getDescribe();
        for (Schema.PicklistEntry entry : typeResult.getPicklistValues()) {
            types.add(entry.getLabel());
        }
        filters.put('Type', types);
        
        // Industry picklist values
        List<String> industries = new List<String>();
        Schema.DescribeFieldResult industryResult = Account.Industry.getDescribe();
        for (Schema.PicklistEntry entry : industryResult.getPicklistValues()) {
            industries.add(entry.getLabel());
        }
        filters.put('Industry', industries);
        
        return filters;
    }

    @AuraEnabled
    public static void deleteAccount(String accountId) {
        try {
            delete [SELECT Id FROM Account WHERE Id = :accountId];
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting account: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String createAccount(String name, String type, String industry, String phone, String website) {
        try {
            Account acc = new Account();
            acc.Name = name;
            acc.Type = type != 'None' ? type : null;
            acc.Industry = industry != 'None' ? industry : null;
            acc.Phone = phone;
            acc.Website = website;
            
            insert acc;
            return acc.Id;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating account: ' + e.getMessage());
        }
    }
}
