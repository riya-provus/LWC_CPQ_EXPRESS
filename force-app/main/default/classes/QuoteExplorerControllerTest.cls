@isTest
public class QuoteExplorerControllerTest {
    
    @testSetup
    static void setup() {
        CPQTestDataFactory.createSettings();
        Account acc = CPQTestDataFactory.createAccount('Test Acc');
        Opportunity opp = CPQTestDataFactory.createOpportunity(acc.Id, 'Test Opp');
        Quote q = CPQTestDataFactory.createQuote(opp.Id, 'Test Quote');
        
        CPQ_Product__c p = CPQTestDataFactory.createProduct('Prod', 100, 50);
        
        Quote_Item__c item = new Quote_Item__c(
            Quote__c = q.Id,
            Item_Name__c = 'Prod',
            CPQ_Product__c = p.Id,
            Quantity__c = 2,
            UnitPrice__c = 100,
            Discount__c = 0,
            Item_Type__c = 'Product'
        );
        insert item;
    }

    @isTest
    static void testGetSummaryAndBreakdown() {
        Quote q = [SELECT Id FROM Quote LIMIT 1];
        
        Test.startTest();
        QuoteExplorerController.QuoteSummary summary = QuoteExplorerController.getQuoteSummary(q.Id);
        List<QuoteExplorerController.BreakdownItem> breakdown = QuoteExplorerController.getQuoteBreakdown(q.Id);
        List<QuoteExplorerController.ApprovalStep> history = QuoteExplorerController.getApprovalHistory(q.Id);
        Test.stopTest();
        
        Assert.areEqual(q.Id, summary.quoteId);
        Assert.isFalse(breakdown.isEmpty());
    }

    @isTest
    static void testLineItemOperations() {
        Quote q = [SELECT Id FROM Quote LIMIT 1];
        CPQ_Product__c p = [SELECT Id FROM CPQ_Product__c LIMIT 1];
        
        Test.startTest();
        List<QuoteExplorerController.LineItemWrapper> items = QuoteExplorerController.getQuoteLineItems(q.Id);
        QuoteExplorerController.SelectionData selection = QuoteExplorerController.getSelectionData();
        
        Quote_Item__c newItem = new Quote_Item__c(
            Quote__c = q.Id,
            Item_Name__c = 'New Item',
            CPQ_Product__c = p.Id,
            Quantity__c = 1,
            UnitPrice__c = 200
        );
        QuoteExplorerController.saveQuoteLineItems(new List<Quote_Item__c>{newItem});
        
        QuoteExplorerController.deleteQuoteLineItem(items[0].id);
        Test.stopTest();
        
        Quote updated = [SELECT Total_Amount__c FROM Quote WHERE Id = :q.Id];
        Assert.areNotEqual(null, updated.Total_Amount__c);
    }

    @isTest
    static void testPDFOperations() {
        Quote q = [SELECT Id FROM Quote LIMIT 1];
        
        Test.startTest();
        String result = QuoteExplorerController.savePDFToQuote(q.Id);
        List<Map<String, String>> pdfs = QuoteExplorerController.getSavedPDFs(q.Id);
        if (!pdfs.isEmpty()) {
            QuoteExplorerController.deleteQuoteDocument(pdfs[0].get('id'));
        }
        Test.stopTest();
        
        Assert.areEqual('Success', result);
    }

    @isTest
    static void testStatusAndApproval() {
        Quote q = [SELECT Id FROM Quote LIMIT 1];
        
        Test.startTest();
        QuoteExplorerController.updateQuoteStatus(q.Id, 'Needs Review');
        try {
            // Exercise the exception branch for no approval process
            QuoteExplorerController.submitForApproval(q.Id);
        } catch(Exception e) {}
        
        // Exercise delete and sync pathways
        try {
            QuoteExplorerController.deleteQuoteLineItem(null); 
        } catch(Exception e) {}
        Test.stopTest();
    }
}
