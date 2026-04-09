@isTest
public class QuotePDFControllerTest {
    
    @testSetup
    static void setup() {
        Account acc = CPQTestDataFactory.createAccount('Test PDF Acc');
        Opportunity opp = CPQTestDataFactory.createOpportunity(acc.Id, 'Test PDF Opp');
        Quote q = CPQTestDataFactory.createQuote(opp.Id, 'Test PDF Quote');
        
        insert new Quote_Item__c(
            Quote__c = q.Id,
            Item_Name__c = 'PDF Item',
            Quantity__c = 1,
            UnitPrice__c = 500,
            Item_Type__c = 'Product'
        );
    }

    @isTest
    static void testControllerInit() {
        Quote q = [SELECT Id FROM Quote LIMIT 1];
        PageReference pageRef = Page.QuoteDocument;
        Test.setCurrentPage(pageRef);
        pageRef.getParameters().put('id', q.Id);
        
        ApexPages.StandardController sc = new ApexPages.StandardController(q);
        
        Test.startTest();
        QuotePDFController controller = new QuotePDFController(sc);
        
        // Null test
        QuotePDFController nullCtrl = new QuotePDFController(new ApexPages.StandardController(new Quote()));
        Test.stopTest();
        
        Assert.areEqual(q.Id, controller.quoteRecord.Id);
        Assert.areEqual(1, controller.wrappedItems.size());
    }
}
