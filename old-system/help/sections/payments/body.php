<?php global $applicationfee ?>
<section>
    <div class="jumbotron jumbotron-fluid">

        <h2 class="text-center">Payments</h2>

    </div>

    <div class='subsection' id='payments-howitworks'>
        <h1>
            <a name="payments-howitworks">Payments: How it works</a>
        </h1>
        <p>When your ItsPlainSailing.com account has been activated for online
            payments, as an administrator you will be able to monitor and
            check the various online payments that are received by your organisation. In
            order to explain how the online payment process works, below we have
            outlined the typical steps involved when one of your members enters
            an event that you have set up.</p>
        <div class='important-notice'>
            <h4>Online Payment Process</h4>
            <table class='instructions'>
                <tr>
                    <td class='number'>1</td>
                    <td class='details'><span class='highlight title'>Member Visits
                    Your Organisation's Public Page</span> - firstly the person goes to your
                        organisations public page using
                        <a target='_blank' class='cluburl' href=''><span
                                    class='cluburl'></span> </a>
                    </td>
                </tr>
                <tr>
                    <td class='number'>2</td>
                    <td class='details'><span class='highlight title'>Select Event/
                    Competition To Enter</span> - the person will see a list of
                        events that are open for entries and they can click on the name of
                        the competition they wish to enter, which brings them to an online
                        entry form.
                    </td>
                </tr>
                <tr>
                    <td class='number'>3</td>
                    <td class='details'><span class='highlight title'>Fill Out Form</span>
                        - the person must fill out the form, providing values for all the
                        mandatory fields in the form, and then they add it to their
                        shopping cart.
                    </td>
                </tr>
                <tr>
                    <td class='number'>4</td>
                    <td class='details'><span class='highlight title'>Review Cart</span>
                        - the person can repeat this process and add more entries. When
                        they have finished making all their entries then click on the
                        Submit Entries button.
                    </td>
                </tr>
                <tr>
                    <td class='number'>5</td>
                    <td class='details'><span class='highlight title'>Provide Credit/ Debit
                    Card Details</span> - they must then provide valid credit/ debit card
                        details for the payment and click Pay.
                    </td>
                </tr>
                <tr>
                    <td class='number'>6</td>
                    <td class='details'><span class='highlight title'>Payment Made and
                    Confirmation email sent</span> - the payment will then be
                        processed and the person will receive an automatic confirmation
                        email.
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <div class='subsection' id='payments-accounting'>
        <h1>
            <a name="payments-accounting">Orders Received</a>
        </h1>
        <p>
            From an accounting point of view you can track all orders/ payments
            and all associated bank transfers by selecting the <b>Payments</b>
            menu option at the top of the page. When you click on the Payments
            menu at the top you see 5 areas on the left namely:
        </p>
        <ul>
            <li><span class='highlight title'>Orders Received</span> - which
                allows the user to view all orders received and to drill in to see
                the details of each order. From here you may also initiate a refund
                for a previously submitted order.
            </li>
            <li><span class='highlight title'>Bank Transfers</span> - which
                allows the user to view all bank transfers (past and pending) for
                their organisation account. Stripe are the company that actually process all
                card payments ensuring that the money paid from a person's Debit/ Credit Card
                ultimately ends up in your organisation's bank account. Stripe do not
                transfer every individual payment into your organisation's bank account,
                instead they operate a rolling weekly window where they combine together all
                card payments received within a period and make a single transfer/ deposit into
                your organisation's bank account. This section of Payments is where you can track
                all past and pending payments from Stripe to your organisation's bank account.
            </li>
            <li><span class='highlight title'>Refunds</span> - which allows the
                user to view all refunds that have been carried out by your organisation.
            </li>
            <li><span class='highlight title'>Cheques/ Offline</span> - here the
                user can view a listing of all cheque/ offline payments made, and to mark cheques/ offline
                payments as
                received/ not received.
            </li>
            <li><span class='highlight title'>Sent Emails</span> - the system keeps a record of the last
                2 weeks of confirmation emails in case a person contacts you and says they did not receive
                one when they submitted their order. This sections provides access to these emails and 
                it also includes a "Forward" option where you can resend it to them if necessary.
            </li>
        </ul>
        <p>The figure below shows an example of the Payments section when you
            click on in initially:</p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-1.png"/>
        </div>
        <p class="figure-title">Payments Section/ Orders Received</p>
        <p>
            When you click on the <b>Orders Received</b> side menu you are presented with a
            paged list of all orders received by your organisation, with the most recent
            orders being displayed first. You can click on the <span
                    class='normalbutton addnewevent'>View</span>
            button to the right of any order listed to drill down to view the
            specific details for that order, as shown in the figure below.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-2.png"/>
        </div>
        <p class="figure-title">Drill Down to Specific Order Details</p>

        <!-- Card -->
        <div class="row">
            <div class="col-3"></div>
            <div class="col-6">
                <div class="card card-image"
                        style="background-image: url(images/watch-video.jpg);">

                    <!-- Content -->
                    <div class="text-white text-center d-flex align-items-center rgba-black-strong py-5 px-4">
                        <div>
                            <h3 class="card-title pt-2"><strong>Watch Short Video</strong></h3>
                            <p>We also have an online video that you can watch which shows how you can monitor
                                orders, issue refunds, review bank transfers and track cheque payments.</p>
                            <a class="btn btn-orange" target="_blank"
                                href="https://www.youtube.com/embed/BOIzi64rQi0"><i class="fa fa-clone left"></i>
                                Click Here to Watch</a>
                        </div>
                    </div>
                    <!-- Content -->
                </div>


            </div>
            <div class="col-3"></div>
        </div>
        <!-- Card -->
    </div>




    <div class='subsection' id='payments-transfers'>
        <h1>
            <a name="payments-transfers">Bank Transfers</a>
        </h1>
        <p>This is an important part of the system as it should provide you with the details of all card payments received
            by your organisation linked to all deposits made into your organisation's bank account.
            While this whole process is managed by Stripe using
            your Stripe account, we try to provide as much detail as you need to reconcile the money paid to you for your
            events, merchandise, memberships and so on, against the actual lodgements that Stripe make into your bank account.
        </p>
        <p>
            In tracking the money deposited into your bank account by Stripe it is important to understand that they
            don't deposit individual card payments one by one into your bank account. Instead they collect up all the
            card payments received on a specific day, and then lodge them into your bank account in one single
            lodgement.
        </p>
        <p>
            Furthermore, Stripe operate a rolling 7 day policy of bank transfers so when a person makes a
            payment, the funds are held for 7 days in Stripe until they are certain that the money arrives
            from the receiving bank, after which the transfer is made to your club/ organisation's bank account.
        </p>
        <p>
            Therefore, it can be challenging to reconcile all your payments received on a particular day against
            your bank deposits, particularly when someone can use their Credit Card and make a single payment
            through Stripe which could include multiple individual items e.g. entries, merchandise, memberships
            and calendar bookings. You can read more
            about Stripe's payment schedules by clicking here <a
                    href="https://stripe.com/docs/payouts#payout-schedule"
                    target="_blank">stripe.com/docs/payouts</a></p>
            <p>This Bank Transfer area is intended to support you in this process.</p>
        <p>
            Under the menu option <b>Payments</b> if you click on the <b>Bank
                Transfers</b> option on the left you see a table listing all your
            organisation's bank transfers (i.e. the money transferred from Stripe to your
            Organisation Bank Account). The figure below shows an example of how this
            looks.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-3.png"/>
        </div>
        <p class="figure-title">View Bank Transfers</p>
        <p>The Bank Transfer's table provides a summary of each bank transfer (i.e. lodgement from Stripe), with
            the following summary fields per transfer:
            <ul>
            <li><strong>Stripe Transfer Id</strong> - this is the unique id set by Stripe which
                can be useful to view this lodgement when logged into your Stripe Account. <strong>Note: </strong>
                in your Stripe Dashboard, in more recent times they have started referring to bank transfers as
                <strong>Payouts</strong>.
            </li>
            <li><strong>Transfer Date</strong> - the date that the transfer took place, or will take place (when the status is Pending)</li>
            <li><strong>Status</strong> - the transfer can be Pending which indicates that it has not been paid yet, or Paid to indicate
            that the lodgement has already been issued to your bank.</li>
            <li><strong>Gross Amount</strong> - this tells you the total amount of money for all card payments that are included in this
            bank transfer/ lodgement/ payout.</li>
            <li><strong>Stripe Fee/ Vat</strong> - this is the total handling fee deducted for all payments included in this
                bank transfer/ lodgement/ payout.</li>
            <li><strong>Refunded Amount</strong> - if there have been any refunds in this particular time period, then the total amount
            refunded is displayed here.</li>
            <li><strong>Refunded Fee</strong> - this indicates the amount of original fees related to refunds that may have taken place.</li>
            <li><strong>Additional Stripe Charges</strong> - this field provides the total amount deducted for this period related to
            any additional fees that Stripe may have charged for this period e.g.
                <ol>
                    <?php if ($countrycode != "gb") { ?>
                    <li><strong>Radar/ Fraud Analysis Fee</strong> - Stripe may charge a fee for the
                        application of their Fraud Detection analysis on card payments which they call Radar
                        (See Radar section here <a href="https://stripe.com/ie/pricing">https://stripe.com/ie/pricing</a>).</li>
                    <li><strong>3D Secure Authentication</strong> - Stripe may also charge an additional 3 or 4 <?php echo isset($cents) ? $cents : "cents"; ?> whenever
                        3D Secure Authentication is required on a payment.</li>
                    <?php } ?>
                    <li><strong>Foreign Cards</strong> - Stripe may charge additional handling fees for foreign cards.
                        <?php if ($countrycode != "gb") { ?>
                            For Irish accounts both UK and Non EU cards are charged at a higher handling fee see
                            <a href="https://stripe.com/ie/pricing"  target="_blank">https://stripe.com/ie/pricing</a> for more details.
                        <?php } else { ?>
                            For UK accounts, any non UK and non EU Cards used can be charged with a higher card handling fee see
                            <a href="https://stripe.com/gb/pricing" target="_blank">https://stripe.com/gb/pricing</a> for more details.
                        <?php } ?>
                    </li>
                </ol>
            </li>
            <li><strong>Transfer Amount</strong> - this is the total amount that will be deposited into your bank account for this
            specific bank transfer/ lodgement/ payout. When looking at the statement from your Bank Account this figure should match what
                has been deposited on the specified Transfer Date.</li>
            </ul>
            To drill down and see the detailed breakdown for a specific Bank Transfer simply click the <span class='normalbutton events'>View</span>
                button to the right. When you drill into a specific Bank Transfer it shows you a breakdown of all Order Payments,
                Refunds and Additional Stripe Fees that are included in that bank transfer, below you will see an example of how this looks.</p>


        <p>
            The detailed breakdown includes the following.
            <ul>
            <li>The various summary totals for this bank transfer, e.g. Gross Amount, Transfer Amount, Stripe Fee...</li>
            <li><strong>Order Entries Included</strong> - this table lists the payments for all entries, memberships etc. that have
                been included in this bank transfer/ deposit.</li>
            <li><strong>Refunded Entries Included</strong> - if any refunds have been deducted from this bank transfer then their details will be
            listed in the table here (note: there were no refunds included in the example above, so there is no table shown)</li>
            <li><strong>Additional Stripe Fees</strong> - if Stripe have added any additional fees that have been deducted from this bank transfer then their
                details will also be listed in the table here.</li>
            </ul>
            </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-5.png"/>
        </div>
        <p class="figure-title">Bank Transfers That Include Refunds</p>


        <h4>Download Transfer Report</h4>
        </p>
        When it comes to reconciling your bank account payments it can be
        useful to generate a report of all transfers for a particular month.
        To do this you should click on the <b>Download Transfers Report</b>
        button in the Bank Transfers page (see red arrow below). When you click
        this button you will be prompted to select the Month that you want to
        generate the report for (see screenshot below).
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-9.png"/>
        </div>
        <p class="figure-title">Download Transfer Report</p>
        <p>
            When you have selected the month and clicked the <b>Download</b>
            button an Excel spreadsheet is generated and automatically downloaded
            to your computer. When you open up this Excel file you will see that
            it has two worksheets, one called <b>Monthly Summary</b> and one
            called <b>Breakdown by Transaction</b>. The <b>Monthly Summary</b>
            worksheet provides a set of summary information in relation to all money received
            in the selected Month,  an example of which is shown in the figure below.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-10.png"/>
        </div>
        <p class="figure-title">
            Example <b>Monthly Summary</b> worksheet
        </p>
        <p>
            The <b>Monthly Summary</b> worksheet provides 3 tables as follows:
            <ul>
                <li>
                    <strong>Bank Transfer Summary</strong> - the first table in the worksheet provides a listing of
                    every bank transfer in the selected month. The Transfer Date and associated Transfer Amount column values
                    in this table should exactly match the deposits that you see in your bank account for that same month.
                </li>
            <li>
                <strong>Rolled up Summary</strong> - this second table contains a summary listing of total money received grouped by
                the different event entries, memberships, merchandise and calendar bookings for the particular month.
            </li>
            <li>
                <strong>Reconciliation Table</strong> - the third table in this worksheet reconciles the money deposited into your bank account
                against the money collected for the different events, memberships etc. The different values in this table are as follows:
                <ul>
                    <li><strong>Total Deposited</strong> - the total amount of funds deposited into your bank account by Stripe, taken from
                        summing up the <strong>Transfer Amount</strong> column values in the first table. </li>
                    <li><strong>Total Received</strong> - This is the total amount of money collected from the various payments received in the
                        month, taken from summing up the <strong>Net Total</strong> column in the second table. </li>
                    <li><strong>Additional Stripe Fees</strong> - If Stripe have deducted any additional fees during the month then the total amount
                    is included here, taken from summing up the <strong>Extra Stripe Fees</strong> column values in the first table.</li>
        <li><strong>Reconcile Difference</strong> - This field shows you the total reconciled difference between the Total
                        Deposited and the Total Received minus the Additional Stripe Fees. This should be quite small, note: you will usually see
                        a small amount here due to rounding differences when calculating handling fees.</li>
                </ul>
            </li>
            </ul>
        </p>
        <p>The second worksheet called <b>Breakdown by Transaction</b> has a more
        detailed breakdown of every transfer listing all payments and all
        refunds that contributed to the transfer amount, an example of which
            is shown in the figure below.</p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-11.png"/>
        </div>
        <p class="figure-title">
            Example <b>Breakdown by Transaction</b> worksheet
        </p>
    </div>

    <div class='subsection' id='payments-vat'>
        <h1>
            <a name="payments-vat">VAT Report</a>
        </h1>
        <p>If you would like to download a monthly VAT report you can do so by going to the <strong>Payments</strong> section 
        and then clicking the <strong>Bank Transfers</strong> menu option on the left. On this page you will see a listing of 
        your bank transfers (lodgements) and above the table on the right you will see a button labelled 
        <span class='normalbutton events'>Download VAT Report</span>.
        <div class="figure-holder">
            <img class="helpfigure" width="960" src="images/vatreport.png"/>
        </div>
        <p class="figure-title">
            Download VAT Report Button
        </p>
        If you click this button you will be prompted to select the month you would like to generate VAT details for. Once you have
        selected the month and clicked the <span class='normalbutton events'>Download</span> button then the system will generate
        an Excel spreadhsheet with a table listing all VAT paid on card payment handling fees for the selected month.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/vatexcel.png"/>
        </div>
        <p class="figure-title">
            Example VAT Report Button
        </p>

    </div>

    <div class='subsection' id='payments-refunds'>
        <h1>
            <a name="payments-refunds">Refunding Payments</a>
        </h1>
        <p>
            Within ItsPlainSailing you can refund a complete order, or you can
            refund individual elements within an order. To refund a complete order
            you should select the menu option "Orders Received" under "Payments"
            and then click on the <b>Refund</b> link to the right of the order
            you wish to refund.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-6.png"/>
        </div>
        <p class="figure-title">Refunding a Complete Order</p>
        <p>
            When you click the refund button for a particular order you will be
            presented with a confirmation window where you must confirm the
            refund request. If you do not wish to complete the refund then click
            the <b>Cancel</b> button, otherwise click the <b>Confirm</b> button
            and the refund will be issued.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-7.png"/>
        </div>
        <p class="figure-title">Confirm Refund</p>

        <p>
            When a refund is issued it does not automatically remove the entries
            associated with the order being refunded. If you would also like the
            entries (if applicable) to be removed from the system then you should select <b>Yes</b>
            in the drop down list shown in the figure above.
        </p>

        <h4>
            <a name="refunds">Refunding Individual Entries</a>
        </h4>
        <p>
            You may also refund individual entries within an Order by clicking on
            the View button for the specific order, and then clicking on the <b>Refund</b>
            button beside that specific entry. Refunding an individual entry
            operates in the same way as refunding a complete order in that you
            will be prompted to confirm the refund, and you will have the option
            of also deleting the entry itself from the system.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-8.png"/>
        </div>
        <p class="figure-title">Refund Individual Entries</p>

        <div class="jumbotron jumbotron-fluid">

            <h2 class="text-center">Refunding and Handling/ Application Fees</h2>
            <p class="text-center" style="font-size:120%; padding: 0 20px"><span style="color:red">NOTE: </span>
                When refunding a payment, currently your account will still be liable for the handling fee charges. 
                Therefore depending on the size of the payment/ card handling fee
                you will receive less money transfered into your account to allow for the Stripe/ Applicaiton
                Fees on the refund.
        </div>
    </div>

    <div class='subsection' id='payments-cheques'>
        <h1>
            <a name="payments-cheques">Tracking Cheques/ Offline Payments Received</a>
        </h1>
        <p>When you set up events, merchandise, calendar bookings and membership types you may allow for payments to be made
            by Cheque/ offline
            bank
            transfer, especially in cases where the fee might be quite large, or
            in the case where your account is not activated for credit/ debit card payments. To faciliate the
            tracking
            of these offline based transactions we have a section
            under <b>Payments</b> called <b>Cheques/ Offline</b>. When you click on <b>Cheques/ Offline</b> you
            will
            be
            presented with a list of all transactions that have been
            submitted by your users where they chose to pay by cheque/ offline. The figure below shows an
            example of
            how this looks.</p>
        <div class="figure-holder">
            <img class="helpfigure" width="760" src="images/payments-12.png"/>
        </div>
        <p class="figure-title">Cheque/ EFTs Listing</p>
        <p>As you can see in the figure above you can also mark cheques/ transfers as having been received or
            not, which
            hopefully will simplify the process of tracking these offline payments for your organisation.</p>
    </div>


    <div class='subsection' id='payments-striperegistration'>
        <h1>
            <a name="payments-striperegistration">More on Stripe Registration</a>
        </h1>
        <p>
            If you wish to accept credit/ debit card payments then you must have a
            stripe account. You can go to the section <a
                    href='#intro-activatingaccount' class='internal-ref'>Account Activation</a> to read
            about how you can go through the steps of activating your Organisation
            Account. In Step 2 of the Account Activation process you will be
            brought to the Stripe website to create an account with them, or register your existing Stripe account
            if you already have one. This part of the activation process is
            external to Its Plain Sailing and is controlled by Stripe, however when creating your account with them
            you will be expected to provide the following information (note: because this is an external site it is
            subject to change without our prior knowledge).
        </p>
        <div class='important-notice'>
            <ul>
                <li><span class='highlight title'>Email</span> - you should enter
                    your email address here. This is your Stripe username and you will
                    use this whenever you wish to log into your Stripe Account
                    Dashboard.
                </li>
                <li><span class='highlight title'>Password</span> - you should enter
                    a suitable password for your Stripe login. Remember to make note of and keep safe a record
                    of the email address and password used for your Stripe login. <strong>It is very 
                        important that you do not forget this.
                    </strong>
                </li>
                <li><span class='highlight title'>Phone number</span> - enter your phone
                    number here and you may be sent a text message with a 6 digit verification code which you
                    may be prompted to enter.
                </li>

                <li><span class='highlight title'>Registered Business Address</span>
                    - select Ireland if based in Ireland, or United Kingdom if based there. Please
                    also fill out your full address, note that you can use your home address if you don't
                    have a business address.
                </li>
                <li><span class='highlight title'>Type Of Business</span> - select
                    Individual/ Sole Trader assuming this is applicable for your organisation.
                </li>

                <li><span class='highlight title'>Legal Name</span> - Put your
                    first/ last name here.
                    <strong>IMPORTANT:</strong> after you have completed this process and created your Stripe
                    account
                    you still need to provide proof of your identity to Stripe, so please make sure that the
                    name
                    entered here matches the name on the specific identity documentation used
                    e.g. drivers license, passport.
                </li>
                <li><span class='highlight title'>Email Address</span> - re-enter your email address here.
                </li>
                <li><span class='highlight title'>Date of birth</span> - Put your
                    date of birth, make sure this is for the person whose name is entered above as the Legal
                    Name.
                </li>
                <li><span class='highlight title'>Phone number</span> - re-enter your phone
                    number here.
                </li>

                <li><span class='highlight title'>VAT Number</span> - if there is no
                    VAT number associated with your club/ organisation then leave this blank.
                    <strong>Note: </strong> this assumes that you have set <strong>Type of Business</strong>
                    to <strong>Independent/ Sole Trader</strong>, if not then you will need to provide a VAT Number
                    for your business.
                </li>


                <li><span class='highlight title'>Business website</span> - if you have
                    a website then put it here, if not put in your facebook, twitter
                    other social media web address
                </li>

                <li><span class='highlight title'>Product description</span>
                    - provide a brief description of what you intend to use the account for, for example,
                    "to accept payments for entries for Events that we are running".
                </li>

                <li><span class='highlight title'>Bank account currency</span> - for
                    Irish organisations make sure this is EUR and for United Kingdom it is set to GBP.
                </li>

                <li><span class='highlight title'>Country of Bank Account</span> - for
                    Irish organisations make sure this is Ireland and for United Kingdom that UK is selected.
                </li>

                <li><span class='highlight title'>IBAN and Confirm IBAN</span> - enter the IBAN of
                    your organisation's bank account. This is the account that the money from
                    all payments received by your organisation will be transferred into
                    automatically on a rolling weekly basis.
                </li>

            </ul>
        </div>

        <p>It is possible that Stripe may ask you for additional information, some examples of which are listed 
            below:</p>

        <div class='important-notice'>
            <ul>

                <li><span class='highlight title'>Business description</span>
                    - if requested you should select from one of the options in the drop down list,
                    e.g. Membership Organisation -> Charity or social service organisations.
                    <strong>Note: </strong> if you select an option that indicates that you are a formal company
                    then Stripe may look for additional verification documentation from you e.g. Company
                    Registration Certificates, Financial History ... which can slow down the process of
                    activating your account with them.

                </li>
                <li><span class='highlight title'>Description box underneath</span>
                    - if requested then you should just enter something about your club/ organisation here.
                </li>

                <li><span class='highlight title'>Company Number</span> - if
                    there is no registered company associated with your club/ organisation then leave this blank.
                </li>
                <li><span class='highlight title'>Statement Descriptor</span> - if requested then enter whatever
                    text you want people to see on their credit card statement when they make a payment to you,
                    e.g. the name of your organisation.
                </li>
                <li><span class='highlight title'>Support Phone Number</span> - if requested you can enter your
                    phone number here unless you have a different dedicated number within your organisation
                    for this purpose.</li>

            </ul>
            <p><span class='highlight title'>Authorise Access to this account</span>
            - When you have entered all the required information you will be asked to
            confirm the information provided and to authorise Its Plain Sailing to carry
            out Credit/ Debit Card payments on your behalf. Please provide this confirmation which will
            then
            redirect you automatically back to the Step 3 in the Account
            Activation page in www.ItsPlainSailing.com.</p>
            <p><span class='highlight title'>Check Your Email</span> - most likely Stripe will also have sent
                you an email to verify your email address. Please make sure that you open this email and
                click the link inside to verify that you are the owner of that email address. </p>
        </div>


        <div class='important-notice'>
            <h4>Completing Stripe Registration</h4>
            <p>If you create a new Stripe Account for your organisation, you may need to
                also provide proof of your identity. To do this you can proceed in
                one of several ways:

            <ul>
                <li><span class='highlight field label'>Email from Stripe</span> -
                    within a couple of days of creating your Stripe account (the time
                    seems to vary) you may receive an automatic email from Stripe
                    explaining that you still need to Confirm Your Identity, and there
                    should be a link in the email which you can use to initiate the
                    process with them.
                </li>
                <li><span class='highlight field label'>Log into Stripe</span> -
                    alternatively you can log into your Stripe account by going to <a
                            target='_blank' href='https://manage.stripe.com/dashboard'>My
                        Stripe Dashboard</a> where you may see a warning across the top of the
                    page with a link to <strong>Complete Verification</strong>, if so click this link and
                    follow the online instructions. If not then select <b>Settings</b> on the Top Right,
                    and then select the Verification option, and follow the on-screen
                    instructions from Stripe.
                    If there is no verification option present then possibly Stripe already has
                    enough information to activate your account and no further action is required on
                    your part.
                </li>
            </ul>
            </p>
        </div>

        <div class='important-notice'>
            <h4>Learning More About Stripe</h4>
            <p>
                If you would like to learn more about Stripe (e.g. how payments
                work, how transfers work, how to login and so forth) then you should
                go to the Stripe Support page by clicking <a
                        href='https://support.stripe.com' target='_blank'>Here</a>.
            </p>
        </div>

        <div class="row">
            <div class="col-3"></div>
            <div class="col-6">
                <div class="card card-image"
                        style="background-image: url(images/watch-video.jpg);">

                    <!-- Content -->
                    <div class="text-white text-center d-flex align-items-center rgba-black-strong py-5 px-4">
                        <div>
                            <h3 class="card-title pt-2"><strong>Watch Short Video</strong></h3>
                            <p>We have an online video that you can watch which brings you through the steps
                                involved in activating your account.</p>
                            <a class="btn btn-orange" target="_blank"
                                href="https://www.youtube.com/embed/vhcV-AC0oMs"><i class="fa fa-clone left"></i>
                                Click Here to Watch</a>
                        </div>
                    </div>
                    <!-- Content -->
                </div>


            </div>
            <div class="col-3"></div>
        </div>
        <!-- Card -->
    </div>

    <div class='subsection' id='payments-yourstripe'>
        <h1>
            <a name="payments-yourstripe">Using your Stripe Account</a>
        </h1>
        <p>It is important that your organisation administrator controls access to
            your stripe account. Please keep your stripe username and password
            safe. All money collected by your organisation for entries is deposited into
            your Stripe account, and then Stripe on a weekly basis will transfer
            this money to your designated Organisation's bank account. At any time you may
            login into your Stripe account and review the previous and upcoming
            bank transfers.</p>
        <div class='important-notice'>
            <h4>My Stripe Dashboard</h4>
            <p>
                To log into Stripe and view the Dashboard for your Organisation Account you
                can click the following link <a target='_blank'
                                                href='https://manage.stripe.com/dashboard' target="_blank">My
                    Stripe Dashboard</a> and then when prompted, enter the email/
                password that you used when originally registering your stripe account.
            </p>
        </div>

        <div class='important-notice'>
            <h4>Learning More About Using Stripe</h4>
            <p>
                It can also be quite useful to view the Stripe Frequently Asked
                Questions which you can get to by clicking the link <a
                        href='https://support.stripe.com/' target="_blank">Stripe Help&Support</a>.
            </p>
        </div>
    </div>


    <div class='subsection' id='payments-handlingcharges'>
        <h1>
            <a name="payments-handlingcharges">Credit/ Debit Card Handling Charges</a>
        </h1>

        <div class='important-notice'>
            <h4>Standard Handling Fees</h4>
            <p>For every successful card payment the handling charges are:</p>
            <p style="padding-left: 20px;"><b><?php if ($_SESSION[SESSION_NAME]['clubtype']['vat'] > 0) {
                        echo "(";
                    }
                    echo (($_SESSION[SESSION_NAME]['clubtype']['onceoff'] * 100)  + $applicationfee) . " " . $_SESSION[SESSION_NAME]['clubtype']['centscode']
                        . " + (" . ($_SESSION[SESSION_NAME]['clubtype']['percentage'] * 100) . "% of the amount being paid)";

                    $vat = '';
                    if ($_SESSION[SESSION_NAME]['clubtype']['vat'] > 0) {
                        echo ") x " . ($_SESSION[SESSION_NAME]['clubtype']['vat'] * 100) . "% VAT";
                        $vat = " and then VAT at 23%";
                    }

                    ?></b></p>
            <p></p>

            <div class='important-notice'>
                <h4>Non-European Cards Full Handling Fee</h4>
                <p>The system has been designed for use by European Credit/ Debit Cards. If a Non European
                    Credit/ Debit
                    Card is used to pay for
                    an order then <b>unfortunately</b> the discounted handling fee does not apply and Stripe
                    will charge
                    the full handling fees
                    of <?php echo ((100 * $_SESSION[SESSION_NAME]['clubtype']['noneuroonceoff']) + $applicationfee) . " " . $_SESSION[SESSION_NAME]['clubtype']['centscode']
                        . " + " . ($_SESSION[SESSION_NAME]['clubtype']['noneuropercentage'] * 100) ?> % of the
                    transaction amount<?php if ($vat == '') {
                        echo '';
                    } else {
                        echo $vat;
                    }; ?>.</p>
            </div>
        </div>
        <?php

        if ($_SESSION[SESSION_NAME]['club']['status'] == 3) {
            ?>
            <div class='important-notice'>
                <h4>Pay By Credit/ Debit Card - Handling Fees Included/ Excluded</h4>
                <p>When setting up Events/ Membership for people to pay by credit/ debit card, you can choose to
                    add the
                    credit/ debit card handling fee <u>on top</u> of the Entry/ Membership Fee (i.e. Handling
                    fee
                    Excluded),
                    or you can choose to <u>include</u> the Handling Fee within the membership/ entry fee (i.e.
                    Handling
                    Fee Included).
                <p>With <strong>Handling Fee Included</strong> (or set to Yes) this means that if a person is
                    paying 100
                    <?php echo isset($currency) ? $currency : ""; ?> , and the handling fee is 2.16, then this
                    amount is included in (i.e. taken
                    out of) the 100
                    <?php echo isset($applicationfee) ? " " . $currency : "fee"; ?>, and so your organisation
                    only get 97.84 into your bank account. With <strong>Handling Fee Excluded</strong> (or
                    Handling Fee
                    Included = No), then the person pays something like 102.16 and then you get
                    100 <?php echo isset($applicationfee) ? " " . $currency : "fee"; ?> into your organisations
                    bank account. </p>
            </div>

        <?php } ?>
        <div class='important-notice'>
            <h4>Learning More About Stripe Handling Fees</h4>
            <p>
                If you would like to read more about Stripe Handling Fees then
                please click the link <a href='https://stripe.com/<?php echo $countrycode; ?>/pricing'
                                            target="_blank">Stripe Charges</a>.
            </p>
        </div>

        <div class='important-notice'>
            <h4>Pay By Cheque/ Offline</h4>
            <p>No handling fee is charged for entries that are made where payment
                is made by cheque/ offline via bank transfer.</p>
        </div>


        <?php
        if ($_SESSION[SESSION_NAME]['club']['status'] < 3) {
            ?>
            <div class='important-notice'>
                <h4>Your Account Is Not Activated For Credit/ Debit Card Processing</h4>
                <p>Please note that since your organisation is not activated for credit/ debit card payments,
                    there are
                    no
                    handling charges
                    or service fees for using ItsPlainSailing, it is free. Fes only start to apply when/ if you
                    activate
                    your ItsPlainSailing account
                    for Credirt Card payment processing. Click <a href='../activate'>Activate</a> to initiate
                    the
                    activation process.</p>
            </div>

            <?php
        }
        ?>
    </div>

    <?php if ($ispremium) { ?>

        <div class='subsection' id='payments-priceplans'>
            <h1>
                <a name="payments-priceplans">Pay In Instalments</a>
            </h1>
            <p>As an additional service for certain accounts, we also allow you to set up instalment based
                payments for
                Events and Membership. So rather than asking someone to pay the full fee up front, you can
                create a payment
                schedule
                where they spread their payments over time (we call this a <strong>Payment Plan</strong> in
                ItsPlainSailing).
            <p>
            <p>
                So if, for example, you are planning to run a Summer Camp for 180 <?php echo isset($currency) ? $currency : ""; ?>s
                you could set up an event with an option to allow people to pay the 180 <?php echo isset($currency) ? $currency : ""; ?>
                s in one go or
                alternatively to pay it in 60 <?php echo isset($currency) ? $currency : ""; ?> instalments spread over a 3 month period,
                in
                advance of running the camp.</p>
            <p>
                There are two main aspects to setting up instalment based payments, the first part is to create
                a <strong>Payment Plan</strong>
                that defines the number of payments to be made, the frequency of the payments and how much to be
                paid in each instalment.
                Then the second part is to update your Event or Membership Type to use the <strong>Payment
                    Plan</strong>.
            </p>
            <p>
                The steps involved to create a <strong>Payment Plan</strong> are as follows.
            </p>
            <table class='instructions'>
                <tr>
                    <td class='number'>1</td>
                    <td class='details'>Log into ItsplainSailing by going to <a
                                href="http://itsplainsailing.com">itsplainsailing.com</a>
                        and clicking the login button on the top right hand corner, and
                        entering your username (i.e. your email address) and password, and then
                        clicking the login button.
                    </td>
                </tr>
                <tr>
                    <td class='number'>2</td>
                    <td class='details'>Select the <span class='topbutton events'>Payments</span>
                        menu option at the top and then the <strong>Payment Plans</strong> sub-menu on the left,
                        where you will see a list of all existing <strong>Payment Plans</strong>.
                    </td>
                </tr>
                <tr>
                    <td class='number'>3</td>
                    <td class='details'>To create a new one, click the <span class='normalbutton events'>Add New Payment Plan</span>
                        button above the displayed table on the right.
                    </td>
                </tr>
                <tr>
                    <td class='number'>4</td>
                    <td class='details'>This causes the <span class='tableheading'>Add
                New Payment Plan</span> form to be displayed where you should
                        fill out the fields of information as follows:
                    </td>
                </tr>
                <tr>
                    <td></td>
                    <td>
                        <ul class='sublist'>
                            <li><span class='highlight field label'>Name</span> - enter a
                                suitable name for this payment plan, e.g. use a name that reflects how the plan
                                will be used, for example, use something that references the Event or Membership
                                Type that it
                                will be used for. So if it is for Summer Camp, and it is 3 by
                                60 <?php echo $currency; ?> instalments one per
                                month then, the name might be <strong>Summer Camp 3 Instalments of
                                    60 <?php echo $currency; ?>s Per Month</strong>.
                            </li>
                            <li><span class='highlight field label'>Description</span> - Enter here a short
                                description of this payment plan which will be
                                displayed to users when choosing to pay using this approach. It is recommended
                                to provide a clear explanation of
                                the payment plan here.
                            </li>

                            <li><span class='highlight field label'>Bank Statement Descriptor</span> -
                                enter here suitable text to be displayed on your customer’s credit card
                                statement.
                                This may be up to 22 characters. The statement description may only include
                                letters and numbers, and will appear on
                                your customer’s statement in capital letters. Note: While most banks display
                                this information consistently,
                                some may display it incorrectly or not at all.
                            </li>

                            <li><span class='highlight field label'>Interval Type</span>
                                - here you must select the type of interval to apply for this payment method.
                                This selection is used in conjunction with the Interval
                                Count field below. So if Interval Type is Days, and Interval Count is 30 then
                                there is 30 days between each payment.
                                If Interval type is Months and Interval Count is 3 then there is 3 Months
                                between each payment.
                            </li>

                            <li><span class='highlight field label'>Interval Count</span> -
                                The size of the interval between each payment. This field is used with the
                                Interval Type to indicate
                                the number of Days, Weeks, Months etc between each payment.
                            </li>

                            <li><span
                                        class='highlight field label'>Number Of Payments</span> - This is the
                                number
                                of payments to be made as part of this payment plan.
                                So if the Interval Type is Months, the Interval Count is 2, the Payment Per
                                Instalment is 20 <?php echo $currency; ?>s and the
                                Number of Payments is 3, then 20 <?php echo $currency; ?>s will be charged at
                                checkout, and then
                                20 <?php echo $currency; ?>s
                                will be charged again after 2 months, with the 3rd and final payment of
                                20 <?php echo $currency; ?>s being paid 4 months from the date of the first
                                payment.
                            </li>


                            <li><span class='highlight field label'>Payment Per Instalment</span>
                                - This is the actual amount to be payed during each instalment of this payment
                                plan. So the total amount the person will be charged at
                                the end when all instalments are in is the
                                <strong>Number Of Payments</strong> multiplied by the <strong>Payment Per
                                    Instalment</strong>.
                            </li>

                        </ul>

                    </td>
                </tr>
                <tr>
                    <td class='number'>5</td>
                    <td class='details last'>When you have filled out the required
                        information you then click the <span class='normalbutton save'>Add</span>
                        button to add this new Payment Plan.
                    </td>
                </tr>
            </table>
            <p class="pt-5">
                Once you have added your payment plan then the next thing to do is to associate it with the
                Event or Membership Type, that it applies to.
                The steps involved in associating a payment plan with an event are outlined below.
            </p>
            <table class='instructions'>
                <tr>
                    <td class='number'>1</td>
                    <td class='details'>Select the <span class='topbutton events'>Events</span>
                        menu option at the top and then click the <span class='normalbutton events'>Edit</span>
                        button
                        for the Event you want to change.
                    </td>
                </tr>
                <tr>
                    <td class='number'>2</td>
                    <td class='details'>Then select the <span class='normalbutton events'>Edit</span> button
                        for the Competition/ Activity that you want to assign this <strong>Payment Plan</strong>
                        to.
                    </td>
                </tr>
                <tr>
                    <td class='number'>3</td>
                    <td class='details'>On the <span
                                class='tableheading'>Edit Competition / Activity Details</span>
                        you should see a section on the right called <strong>Instalment Payment Options</strong>
                        where you should edit the field <strong>Allow Pay By Instalments</strong> and set it to
                        <strong>Yes</strong> and then save this change, which will cause the <strong>Payment
                            Plan</strong>
                        field to be displayed underneath.
                    </td>
                </tr>
                <tr>
                    <td class='number'>4</td>
                    <td class='details'>Edit this <strong>Payment Plan</strong> field and select the payment
                        plan to use from the
                        drop down list that is displayed and save your selection.
                    </td>
                </tr>

            </table>
            <p class="pt-5">
                <strong>Note 1: </strong> The steps to use a Payment Plan
                for a Membership Type are more or less the same as for an Event, except that you must go to the
                Settings -> Membership to edit the
                Membership Type and select the Payment Plan to use.
            </p>
            <p>
                <strong>Note 2: </strong> A <strong>Payment Plan</strong> can only be used once, you cannot use
                it for more than one Event/ Activity or Membership
                Type. If you have multiple Event Activities or Membership Types that you would like to provide
                instalment based payments then you must
                create an individual <strong>Payment Plan</strong> for each instance/ case.
            </p>
            <p>
                <strong>Note 3: </strong> If you do not see the <strong>Payment Plan</strong> sub menu on the of
                the <strong>Payments</strong>
                section then it means that either your account is not yet activated, or that this feature is not
                available for your account.
            </p>

            <h2>Tracking Instalment Payments</h2>
            <p> When it comes to tracking instalment based payments, we provide various options as follows:</p>
            <ul>
                <li>Under Payments you can see in the column "Paid By" an indication as to which payment was
                    made (e.g. Instalment (1 of 3) ).
                </li>
                <li>On the specific Events page when you download all entries for an event
                    you will see that the "Paid By" column indicates whether the entry was paid in full or in
                    instalments.
                </li>
                <li>If you go to the Payments menu and click Bank Transfers and download the Bank Transfer
                    report for a specific month,
                    and click on the worksheet "Breakdown By Transaction" you can see those payments that were
                    made via instalments,
                    so as each instalment comes in you can check it off from here if it suits.
                </li>
                <li>Every time an instalment payment is made, first, second or third etc., an email is
                    automatically sent to
                    the email addresses configured under "Email Notifications:" for that event, with the details
                    of the
                    instalment payment that was made.
                </li>
            </ul>
        </div>
        <!-- Card -->
        <div class="row">
            <div class="col-3"></div>
            <div class="col-6">
                <div class="card card-image"
                        style="background-image: url(images/watch-video.jpg);">

                    <!-- Content -->
                    <div class="text-white text-center d-flex align-items-center rgba-black-strong py-5 px-4">
                        <div>
                            <h3 class="card-title pt-2"><strong>Watch Short Video</strong></h3>
                            <p>We have an online video that you can watch which brings you through the steps
                                involved in adding and using <strong>Payment Plans</strong>.</p>
                            <a class="btn btn-orange" target="_blank"
                                href="https://www.youtube.com/embed/OVur90WFCEQ"><i class="fa fa-clone left"></i>
                                Click Here to Watch</a>
                        </div>
                    </div>
                    <!-- Content -->
                </div>


            </div>
            <div class="col-3"></div>
        </div>
        <!-- Card -->
    <?php } ?>

</section>