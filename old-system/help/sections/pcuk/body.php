<?php global $applicationfee ?>
<section>
    <div class="jumbotron jumbotron-fluid">

        <h2 class="text-center">UK Pony Club Integration</h2>

    </div>

    <div class='subsection' id='pcuk-intro'>
        <h1>
            <a name="pcuk-intro">Integration with the PCUK Pelham System</a>
        </h1>
        <p >
            The ItsPlainSailing system has been integrated with the UK Pony club's membership system called Pelham.
            What this means is that when you set up events within your ItsPlainSailing account, the events and their associated
            activities will automatically be registered with this central Pelham system.            
        </p>
        <p>
            Then as your branch members enter these events, the ItsPLainSailing system automatically connects with
            the Pelham membership database to verify that the person entering is a valid member.
        </p>
        <p>
            When an event is over, ItsPlainSailing also makes it easy for committee members to report the details of
            all attendees to the Pelham system, and in those cases where there is some form of qualification included as
            part of the event, we also allow you to simply mark who did and did not achieve the qualification while partaking 
            in the event.
        </p>       
    </div>

    <div class='subsection' id='pcuk-events'>
        <h1>
            <a name="pcuk-events">Event Setup</a>
        </h1>
        <p>
            When you set up an event for your Pony Club Branch you will be need to provide the following additional fields of information which 
            are required by the PCUK Pelham system.
        </p>
        <ul>
            <li><span class='highlight title'>Event Type</span> - the UK Pony Club have defined a set of Event Types that they 
            use to categorise all events that take place within the branches. You can see the full list of UK Pony Club Event Types
            if you click on Events and then in the menu on the left click "Event Types" (see below).
            <div class="figure-holder">
                <img class="helpfigure" width="660" src="images/EventTypesListed.png"/>
            </div>
            <p class="figure-title">UK Pony Club Event Types</p>
        <p>In the form for adding an Event you can select the Event Type from the "Event Type" drop down list shown in the "UK Pony Club" section of the form.</p>
            <div class="figure-holder">
                <img class="helpfigure" width="660" src="images/SelectEventType.png"/>
            </div>
            <p class="figure-title">Select the Event Type in Add Event Form</p>
            </li>
            <li>
                <span class='highlight title'>Venue</span> - the UK Pony Club also requires the branch to provide details of the 
                Venue for every Event taking place. You can manage all your Venues if you click the Events menu option across the top of the screen and then 
                click "Venues" on the left. This will bring you to the section where you can register the different venues that you are using for your events 
                (see example screenshot below).
            <div class="figure-holder">
                <img class="helpfigure" width="660" src="images/Venues.png"/>
            </div>
            <p class="figure-title">Venues</p>
        <p>In the form for adding an Event you will also see the  "Venue" drop down list beside the Event Type field.</p>
            <div class="figure-holder">
                <img class="helpfigure" width="660" src="images/SelectEventType.png"/>
            </div>
            <p class="figure-title">Select the Event Type in Add Event Form</p>
            </li>
        </ul>
    </div>

    <div class='subsection' id='pcuk-addactivity'>
        <h1>
            <a name="pcuk-addactivity">Registering Event Activities</a>
        </h1>
        <p>
            Having added your Event you then need to add your individual Activities into your event (also known as Event Sessions in Pelham). 
            When you add an Activity to an Event the ItsPlainSailing system will automatically register that Activity with Pelham.
            When setting up your Activity you need to provide two additional fields of information with the event set up as follows:
        </p>
        <ul>
            <li>
                <span class='highlight title'>Entries Open To</span> - for this activity you need to indicate who can enter this Activity with
            the following options supported.
                <ul>
                    <li><span class='highlight title'>Open To All</span> - with this option anyone can submit an application for this event activity.</li>
                    <li><span class='highlight title'>Open To Current Members of Our Branch</span> - only members of your branch can submit an application. In this case the 
                        system will automatically place a Membership Number field as the first field in the application form and then when the person fills 
                        out the form and tries to add it to their shopping cart the system will check with Pelham to make sure that the person entering is a 
                        valid member of your branch.
                    </li>
                    <li><span class='highlight title'>Open To Current Members of Our Area</span> - only members of your Area can submit an application. As before the 
                        system will automatically place a Membership Number field as the first field in the application form and then when the person fills 
                        out the form and tries to add it to their shopping cart the system will check with Pelham to make sure that the person entering is a 
                        valid member of your Area.</li>
                    <li><span class='highlight title'>Open To Any Current Member of the UKPC</span> - any member of the UKPC can submit an application. Again, the 
                        system will automatically place a Membership Number field as the first field in the application form and then when the person fills 
                        out the form and tries to add it to their shopping cart the system will check with Pelham to make sure that the person entering is a 
                        valid member of the UK Pony Club (any Branch).</li>
                </ul>            
            <li>
                <span class='highlight title'>Qualification/ Achievement/ Test</span> - if the Event Activity being added involves the awarding or testing of a 
                qualification or achievement then you can select it from this drop down list. <strong>Note: </strong> the list is quite large so if you start typing 
                you should be able to find the value you are looking for.
            </li>
        </ul>
        <p>When you have filled out the Add New Activity form and clicked the Add button, the system will automatically register the details of this new Activity 
            with the PCUK's central Pelham system.</p>
    </div>


    <div class='subsection' id='pcuk-registerattendees'>
        <h1>
            <a name="pcuk-registerattendees">Registering Attendees</a>
        </h1>
        <p>
            When an event is over you can go into the Activity and use the "Register Attendees With PCUK" button (see screenshot below) to update the central PCUK Pelham system with the 
            results of the event, indicating who attended and who achieved their qualification/ test (if applicable).
            
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="660" src="images/RegisterAttendees.png"/>
        </div>
        <p class="figure-title">Register Attendees Button In Activity Form</p>
        <div class="figure-holder">
            <img class="helpfigure" width="660" src="images/SelectAttendees.png"/>
        </div>
            <p class="figure-title">Select Members who Attended and Qualified/ Passed</p>                   
    </div>

    <div class='subsection' id='pcuk-registerattendees'>
        <h1>
            <a name="pcuk-registerattendees">Step By Step Guides</a>
        </h1>
        <p>
            To help with learning how to use the PCUK specific elements of the system we have recorded a set of short videos to demonstrate how it works.
            Simple click the name/ title below to launch and watch that specific video.
            <ul>
                <li><a href="https://www.youtube.com/embed/eye1BU8piHY" target="_blank">Adding a Venue</a></li>
                <li><a href="https://www.youtube.com/embed/yUoE-U3uee4" target="_blank">Setting up event and registering attendees</a></li>
                
            </ul>
            
        </p>
               
    </div>
</section>