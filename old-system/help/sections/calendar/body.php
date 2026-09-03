<section>
    <div class="jumbotron jumbotron-fluid">

        <h2 class="text-center">Calendar Bookings</h2>

    </div>
    <div class='subsection' id='calendar-whatisit'>
        <h1>
            <a name="calendar-whatisit">Calendar Bookings: What Are They</a>
        </h1>
        <p>
            If you would like people to be able to book and pay online for specific timeslots within a
            calendar then you can use the Calendar Booking functionality. For example, let's say you are running
            lessons/ classes
            every Tuesday and Thursday during the winter months with 8 places available for booking in each
            lesson. If so then
            you can use ItsPlainSailing to allow people to select the lessons they want to attend and pay
            online.
            Or another example, let's say you have gym facilities and you want to allow people to reserve them
            for specific
            hourly sessions, then you can use ItsPlainSailing to manage this for you also.
        </p>
        <p>
            As an ItsPlainSailing administrator you can set up these bookings, defining the days and times that
            are available to be
            booked, and then let ItsPlainSailing manage the actual booking and payment process. The solution is
            quite flexible so
            you can define what days of the week apply, and what time slots within each different day of the
            week are available. You can also
            block out specific date ranges or specific time segments within the day.
        </p>
        <p>
            In the figure below you see an example of how the form can look for people making a calendar
            booking.
            In Step 1 the person can select the month in question and see those days listed (in green) that are
            available for
            booking. When a person selects a specific day, in this example case, the 6th of September, then Step
            2 automatically displays those
            timeslots within that day that are available for booking i.e. those which are not already booked
            out.
            In step 2 you can click the <strong>Book</strong> button on the right to select a specific timeslot
            which adds it
            to your <strong>Selected Timeslots</strong> shown in Step 3 of the figure. You can add/ remove
            additional timeslots
            on different days before finally adding them to your shopping cart for checking out and paying.
            Also, some timeslots may have more than one place available (see red arrow below), in which case you
            can select the drop down
            list to book multiple places.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="797"
                    src="images/example-calendar-booking.png">
        </div>
        <p class="figure-title">Example Calendar Booking Form</p>

    </div>

    <div class='subsection' id='calendar-setup'>
        <h1>
            <a name="calendar-setup">Setting Up Calendar Bookings</a>
        </h1>
        <p>
            The first step involved in configuring a Calendar Booking for your organisation is to create the
            Calendar that will be used.
            The Calendar is a definition of the days of the week and times of the day that are available for
            booking. To create a new Calendar you
            should log into your ItsPlainSailing administration area and select the Calendar menu at the top of
            the screen, and then select the Calendar
            sub-menu on the left.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="797"
                    src="images/add-calendar.png">
        </div>
        <p class="figure-title">Calendar Administration Area</p>

        <p>
            When you have selected the Calendar sub-menu on the left you will see a list of all the existing
            calendars, with an <span
                    class='normalbutton editentry'>Add New Calendar</span> button above the table on the right.
            To
            add a
            new calendar click this button and you
            will be presented with the add calendar form (see below).
        </p>

        <div class="figure-holder">
            <img class="helpfigure" width="797"
                    src="images/add-calendar-1.png">
        </div>
        <p class="figure-title">Example Add New Calendar Form</p>

        <p>
            In the example shown above we are adding a new calendar for the period of time from 1st November to
            the 1st of March and we are calling it
            <strong>Winter Lessons Calendar</strong>. You will also see a field called <strong>Places
                Label</strong>,
            by default we use the term Places to refer to what people are booking in a timeslot, however you can
            change
            this label text to suit your specific calendar, e.g. if what people are booking is not called
            places, but something else e.g. Horses, courts.
            When you click the <span
                    class='normalbutton save'>Add</span> button a default definition for this
            new calendar is added to the system. The default calendar you have just created may need to be
            further edited to define the exact days of the
            week and times of the day that apply. To do this click the <span
                    class='normalbutton editentry'>Edit</span> button to the right of the new
            Calendar you have just added (see red arrow below).

        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="797"
                    src="images/add-calendar-2.png">
        </div>
        <p class="figure-title">Editing this New Calendar Form</p>

        <p>When you click the <span class='normalbutton editentry'>Edit</span> button you will be presented with
            a
            screen that looks something like the one shown
            below.</p>

        <div class="figure-holder">
            <img class="helpfigure" width="797"
                    src="images/edit-calendar-1.png">
        </div>
        <p class="figure-title">Edit Calendar Form</p>

        <p>
            As can been seen from this screenshot, there is more to a Calendar definition that its name and
            description. Here you can define the
            <strong>Calendar Settings Per Day</strong> (a.k.a Days of the Week)
            that are available for booking (see <span style="color:red">1</span>) and you can also define
            specific <strong>Excluded Date Ranges</strong>
            (see <span style="color:red">2</span>) which allows you to mark specific dates that are not
            available for booking (e.g. Christmas).
        </p>
        <p>
            From the Edit Calendar Form you can make additional changes to your Calendar as follows:
        <ul>
            <li>
                <span class='highlight title'>Days Open For Booking</span> - for the 7 days of the week you can
                mark which ones
                are open for bookings and which ones are not. By default when a Calendar is created then all 7
                days of the week are marked
                as <strong>Not Open For Booking</strong>. To update a specific one so that it is available for
                booking, simply
                click the <span class='normalbutton editentry'>Edit</span> button for that day (see <span
                        style="color:red">3</span>) and
                then change the <strong>Status</strong> field to <strong>Open For Booking</strong>. For
                example if this calendar
                relates to lessons given during the week then you might mark Saturday and Sunday as <strong>Not
                    Open For Booking</strong>, and only set Monday to Friday with the status <strong>Open For
                    Booking</strong>.
            </li>
            <li>
                <span class='highlight title'>Excluded Specific Date Ranges</span> - for each calendar you can
                also
                define complete ranges of days that are not open for booking. To do this simply click the <span
                        class='normalbutton editentry'>Add Excluded Date Range</span> button (see <span
                        style="color:red">5</span>) and then fill out the
                form that is displayed,
                setting a suitable <strong>name</strong> and then set <strong>Exclusion Start Date</strong> and
                <strong>Exclusion End Date</strong> to the start and end dates for the range of days that is to
                be
                excluded. You can also set the field <strong>Recurring Every Year</strong> to
                <strong>Yes</strong>
                if this date range will apply at the exact same days every year or set it to
                <strong>No</strong>
                if this excluded date range only applies to the current year.

            </li>
            <li>
                <span class='highlight title'>Define Time Slots Within a Day</span> - for each day of the week
                for which you are accepting bookings you can edit it and define the details of the timeslots
                that are available for booking within that day. To do this click the <span
                        class='normalbutton editentry'>Edit</span> button for that day (see <span
                        style="color:red">3</span>), and then you can edit the fields as follows:
                <ul>
                    <li><span class='highlight title'>Day Start Time</span> - set this to the hours/ minutes
                        (i.e. HH:MM) for the start time of the first available timeslot for booking within
                        this day.
                    </li>
                    <li><span class='highlight title'>Day End Time</span> - set this to the HH:MM for the end
                        time
                        of the last available time slot within this day.
                    </li>
                    <li><span class='highlight title'>Minutes Per Timeslot</span> - set this to the number of
                        minutes
                        that makes up a single timeslot, e.g. set it to 60 to allow booking of 1 hour timeslots
                        within
                        this day.
                    </li>
                    <li><span class='highlight title'>Booking Fee</span> - this is the fee amount to be charged
                        for
                        each individual place booking for a timeslot within this specific day. With this field
                        you can
                        set different booking fees for different days of the week, e.g. one rate for week days
                        and one
                        rate for weekends.
                    </li>
                    <li><span class='highlight title'>Status</span> - as mentioned previously if you set this to
                        <strong>Not Open For Booking</strong> then this particular day of the week will not be
                        presented to people when making a booking choice.
                    </li>
                    <li><span class='highlight title'>Bookings Per Timeslot</span> - by default each timeslot
                        accepts
                        one place booking and then it is considered booked and is no longer available for others
                        to book. However you can use this field to allow more than one place to be booked per
                        timeslot.
                        So for example if you have a timeslot from 9:00 to 10:00 and you set this to 4, then the
                        system will automatically allow up to 4 bookings to be taken for this timeslot before
                        marking it
                        automatically as booked out.
                    </li>
                    <li><span class='highlight title'> Minimum Bookings Per Timeslot</span> - You can set a
                        minimum number of bookings that must be made for a specific time slot. Note: if used,
                        then Bookings Per Timeslot should be greater than 1, and this should have a value less
                        than Bookings Per Timeslot. So for example if <strong>Bookings Per Timeslot</strong> is
                        set to 10
                        and <strong>Minimum Bookings Per Timeslot</strong> is set to 8 then the drop down list
                        of number of places to be booked starts at 8, not 1.
                    </li>

                    <li><span class='highlight title'>Timeslot Booked if Person Books Minimum </span> -
                        If you have set a Minimum Bookings Per Timeslot
                        and if you want the timeslot to be booked out once one person books the minimum number
                        of places,
                        then set this to Yes. So for example if <strong>Bookings Per Timeslot</strong> is set to
                        10
                        and <strong>Minimum Bookings Per Timeslot</strong> is set to 8 and this field is set to
                        <strong>Yes</strong> then if someone books 8 places, even though there might be more
                        places
                        left, since the minimum number of places has been booked, the timeslot is marked as
                        fully
                        booked and no one else can book places for this specific slot.
                    </li>


                </ul>
            </li>
            <li>
                <span class='highlight title'>Excluded Time Slots During The Day</span> - within a specific Day
                Of the Week it is also possible to define specific times within the day that are not available
                for
                booking. To do this you can click the <span
                        class='normalbutton editentry'>Add Excluded Period</span> button on the Day Of Week Edit
                form
                and then set the <strong>Name</strong> field as required, and then set the
                <strong>Exclusion Start Time</strong> and <strong>Exclusion End Time</strong> to cover the time
                range within the day to exclude, e.g. you might set <strong>Name</strong> to Lunch, and then
                set <strong>Exclusion Start Time</strong> to 12:30 and <strong>Exclusion End Time</strong> to
                13:30.
            </li>
        </ul>

        </p>
        <p>
            As an example, let's say you are running lessons during the month of December, every Tuesday and
            Thursday
            with 7 by 1 hour lessons per day starting at 9am and finishing at 5pm, with a break for lunch
            between 1 and 2. And let's say that you will not be providing lessons for those days over christmas
            from 24th to the 28th. Also you are going to allow 4 people per lesson and you are going to charge
            10.00 <?php echo isset($currency) ? $currency : ""; ?>
            per person per lesson. To set a calendar for this type of booking you would do the following.
        <ul>

            <li>
                <span class='highlight title'>Add new calendar</span> - add a new calendar and set the
                <strong>Calendar Start Date</strong> to 1st Dec, 2018, and the <strong>Calendar End
                    Date</strong> to 31st Dec, 2018.
            </li>
            <li>
                <span class='highlight title'>Edit The Days Of Week</span> - edit the new calendar and
                set the status for Tuesday and Thursday to
                <strong>Open for Booking</strong>.
            </li>
            <li>
                <span class='highlight title'>Edit Tuesday and Thursday</span> - edit the days of the week
                setting
                Tuesday and Thursday with a
                <strong>Day Start Time</strong> of 09:00 and a <strong>Day End Time</strong> of 17:00, set the
                <strong>Minutes Per Time Slot</strong> to 60 (i.e. for 1 hour), set <strong>Bookings Per
                    Timeslot</strong> to 4 and set the <strong>Booking Fee</strong> to
                10.00 <?php echo isset($currency) ? $currency : ""; ?>.
            </li>
            <li>
                <span class='highlight title'>Set Excluded Period</span> - for both Tuesday and Thursday
                click the
                <span
                        class='normalbutton editentry'>Add Excluded Period</span> button and set the
                <strong>Name</strong> field to Lunch and then set <strong>Exclusion Start Time</strong>
                to 13:00 and <strong>Exclusion End time</strong> to 14:00.
            </li>
            <li>
                <span class='highlight title'>Set an Excluded Date Range For Christmas</span> - click the
                <span
                        class='normalbutton editentry'>Add Excluded Date Range</span> button and set the
                <strong>Name</strong> field to Christmas and then set <strong>Exclusion Start Date</strong>
                to 24/12/2018 and <strong>Exclusion End Date</strong> to 28/12/2018.
            </li>

        </ul>

        </p>
        <p>
            <span class='highlight title'>Important</span> - when you have added a Calendar, you have still not
            completed the set up process and you still must create a booking type. Read the next section to
            learn
            how to create a booking type which uses the Calendar that you have set up.
        </p>
        <p>
            <span class='highlight title'>Note</span> - the definition of Calendars has been separated out from
            the setup of booking types so that, where applicable and if suitable for you, the definition of a
            single Calendar can be created once, and then it can be used multiple times in different booking
            types.
        </p>
    </div>

    <div class='subsection' id='calendar-addingbookingtype'>
        <h1>
            <a name="calendar-addingbookingtype">Adding Booking Types</a>
        </h1>
        <p>
            A Booking Type is where you set up the actual calendar based activity that you want to allow people
            to book. If you do not create a Booking Type for your Calendar then nothing will be displayed on
            your public page.
            To manage the Booking Types for your organisation select the Calendar menu at the top of
            the screen where all existing Booking Types will be displayed (see below).
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="797"
                    src="images/add-booking-type-1.png">
        </div>
        <p class="figure-title">Manage Booking Types</p>

        <p>
            To add a new Booking Type click the <span
                    class='normalbutton editentry'>Add Booking Type</span> button above the table on the right
            and
            then fill out
            the form with the details as required (see example of one already filled out below).
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="1000"
                    src="images/add-booking-type-2.png">
        </div>
        <p class="figure-title">Add Booking Type Form</p>

        <p>
            The various fields to be filled out when adding a Booking Type are as follows:
        <ul>
            <li>
                <span class='highlight title'>Name</span> - enter a meaningful name for this booking type as
                this will be the
                name that is displayed to people when looking to make a booking.
            </li>
            <li>
                <span class='highlight title'>Description</span> - also enter a meaningful description here for
                this booking type as again, the description
                you enter here will be displayed to people when looking to make a booking. You should make this
                as informative as possible.
            </li>
            <li>
                <span class='highlight title'>Status</span> - by default all booking types are <strong>Open for
                    Booking</strong> however you can change
                this to <strong>Not Open for Booking</strong> at any time which will remove it from your online
                Public page so it is not available for booking.
            </li>
            <li>
                <span class='highlight title'>Calendar Display Colour</span> - if using the Calendar View you can
                select the colour to use when displaying this booking type in the Calendar view.
            </li>
            <li>
                <span class='highlight title'>Calendar</span> - from this drop down list you can select the
                calendar that you want
                to use for this specific booking.
            </li>
            <li>
                <span class='highlight title'>Number of Days In Advance</span> - Set this to the number of days
                in advance that bookings for a
                specific date must be made. Leave this at zero if advance booking is not required, otherwise for
                example, if set to 2 then all
                bookings for a specific date must be made two days or more <u>before</u> the actual date being
                booked.
            </li>
            <li>
                <span class='highlight title'>Set Max. Days in Advance</span> - Set this to Yes if you would
                like the system to enforce a limit on the number of days in advance that a booking can be made.
                If this field is set to Yes then you can specify the maximum days to apply by editing the
                <strong>Max. Days In Advance</strong> field.
            </li>
            <li><span class='highlight title'>Use Terms And Conditions</span> - If you would like to specify
                terms
                and conditions in the booking form then set this to Yes.
            </li>
            <li><span class='highlight title'>Terms And Conditions</span> - If <b>Use Terms And
                    Conditions</b> is
                set to Yes then you must enter the actual terms and conditions text here that will be
                displayed on
                the Booking form.
            </li>
            <li><span class='highlight title'>Can Cancel Bookings</span> - Set this to yes if people can cancel
                their bookings after they have been made.
            </li>

            <li><span class='highlight title'>Cancel Days In Advance</span> - Please set this to the number of
                days in advance that someone is allowed cancel a booking. Leave this at zero if the person can
                cancel right up to the date/ time of the specific booking. Otherwise for example, if set to
                2 then it will only be possible to cancel a booking up to two days before the actual booked
                time slot, if the time is less than 2 days then the cancel option will not be available.
            </li>

            <li><span class='highlight title'>Refund Payment Automatically</span> - By default the person will
                be refunded automatically if they cancel a booking, if you don't want a refund to happen when
                the booking is cancelled then set this to No.

            </li>

            <li><span class='highlight field label'>Allowed Payment Method</span>
                - Here you can select the payment methods supported for this booking type, you can allow
                people to pay by credit/ debit card, by cheque/ offline or by both.
                <span class='highlight'>Note:</span> if your organisations
                account is not activated for credit/ debit card payments then only the
                <strong>Pay By Cheque / Offline</strong> option will be available.

            </li>

            <li><span class='highlight field label'>Handling Fee Included</span>
                - If you choose payment by credit/ debit card
                then you will also have the option to indicate if the Credit/ Debit Card
                Handling charge is included in the fee or if it is exlcuded
                (i.e. should be added on top of the fee). For more
                information on credit/ debit card handling fees goto
                <a class='internal-ref' href='#payments-handlingcharges'>Handling
                    Fees</a>.
            </li>

            <li><span class='highlight field label'>Cheque/ Offline Payment Instructions</span>
                - If you choose payment by Cheque / Offline then you should provide a description of
                how a person should make the payment. For example, who do they make the
                cheque
                payable to, where is the cheque sent to. Or if bank transfer is allowed then provide
                details of the IBAN that the person can use to make the payment. The text that is
                entered
                here will be automatically included in the confirmation email sent to the person
                once they
                have checked out.
            </li>

            <li><span class='highlight field label'> Link This with Other Bookings Types</span>
                - You can link this Booking Type to one or more others so that booking a time slot in this
                Booking Type will automatically reserve the same time slot in the other linked ones. This can
                be useful if you have the one facility that people can book, but where you want to allow them
                the choice of booking different time intervals for different prices. For example if you
                want to offer a 1 hour booking for 30 <?php echo isset($currency) ? $currency : ""; ?>,
                and a 2 hour booking for 55 <?php echo isset($currency) ? $currency : ""; ?>. To do this
                you would create 2 Calendars, one for the 1 hour option and one for the 2 hour option. Then
                you would create 2 Bookings Types, a 1 hour one and a two hour one, i.e. one for each of the
                Calendars,
                and then in booking type 1 you set <strong>Link This with Other Bookings Types</strong> to
                <strong>Yes</strong> and
                use the <strong>Linked Booking Types</strong> to link
                it to booking type 2, and in booking type 2 you set <strong>Link This with Other Bookings
                    Types</strong>
                to <strong>Yes</strong> and
                use the <strong>Linked Booking Types</strong> to link it to booking type 1.
            </li>

            <li><span class='highlight field label'>Add Extra Field</span>
                - By default when someone is making a booking online they are prompted to provide a contact
                name,
                email address and mobile number for the booking. If you would like the person making the booking
                to provide an extra field of information then you can set the field <strong>Add Extra
                    Field</strong>
                to <strong>Yes</strong>, and then you can use the following fields to customise how this extra
                field will look on the
                booking form.
                <uL>
                    <li><span class='highlight field label'>Optional Field Label</span> - here you can enter the
                        label text for this extra field that you would
                        like to be displayed to the person making the booking.
                    </li>
                    <li><span class='highlight field label'>Optional Field Description</span> - type into this
                        box any description text that you
                        would like to be displayed to the person booking which explains to them what it is that
                        they need to fill out in this
                        extra field.
                    </li>
                    <li><span class='highlight field label'>Make Extra Field Mandatory</span> - set this to
                        <strong>Yes</strong> if
                        you would like to force people to fill out this field when making a booking, otherwise
                        it will be an optional field and so can be left blank when making a booking.
                    </li>
                </uL>
                For example, if you wanted to add an extra field to the booking form to get the names of anyone
                else that might be using the booking with you then you could set the following:
                <uL>
                    <li><span class='highlight field label'>Optional Field Label</span> - Names of Others</li>
                    <li><span class='highlight field label'>Optional Field Description</span> - Please enter the
                        names of
                        anyone else that will be using this booking with you.
                    </li>
                    <li><span class='highlight field label'>Make Extra Field Mandatory</span> - Yes</li>
                </uL>
            </li>

            <li><span class='highlight field label'>Apply Promotion/ Discount</span>
                - Optionally you can offer a promotional discount on a booking type by setting the
                Apply Promotion/ Discount: field to Yes. You can specify the Discounted Price to apply,
                and the promotional code that people must enter in order to avail of the promotion.
                <uL>
                    <li><span class='highlight field label'>Apply Promotion/ Discount</span> - Set this to Yes
                        if you would like to offer a special discount/ promotion connected to this booking type.
                    </li>
                    <li><span class='highlight field label'>Discounted Price</span> - Set this to the discounted
                        amount that applies to anyone who avails of this promotion. Note: set it to zero
                        to make it free.
                    </li>
                    <li><span class='highlight field label'>Discount/ Promotion Code</span> - Enter the
                        promotional discount code that people must use to avail of this discount/ promotion.
                    </li>
                </uL>
                For example, in the screenshot above it has set a discounted price of 5
                <?php echo isset($currency) ? $currency : ""; ?> for anyone making a booking who can
                enter the promotional code <strong>PROMO5</strong> on the booking form.
            </li>

            <li><span class='highlight field label'>Add Message To Confirmation Email</span> -
                If you want to add an extra message to the confirmation emails that get sent to
                people booking slots on this calendar then set this to Yes and then in the
                <strong>Confirmation Email Message</strong> field that is displayed type in the
                text that you would like to appear on the confirmation email.
            </li>

        </ul>
        </p>
    </div>

    <div class='subsection' id='calendar-reservetimes'>
        <h1>
            <a name="calendar-reservetimes">Reserving Timeslots</a>
        </h1>
        <p>As people select and book specific time slots, from time to time you may wish to pick out a specific
            time or set of times and mark them as reserved so that they are not actually available for booking.
            To do this you should go to the Booking Types section and then click the <span
                    class='normalbutton editentry'>Edit</span> button for the booking type that you want to
            change
            and
            then click the <span
                    class='normalbutton editentry'>Reserve Timeslots</span> button above the table on the right
            (see
            screenshot below).</p>
        <div class="figure-holder">
            <img class="helpfigure" width="700"
                    src="images/reserve-timeslots.png">
        </div>
        <p class="figure-title">Initiate Reserving of Timeslots on a booking type</p>

        <p>When you click the <span
                    class='normalbutton editentry'>Reserve Timeslots</span> button a screen like the one shown
            below
            will be presented to you. From here you can select the date you wish to reserve timeslots on <span
                    style="color:red">(1)</span>,
            then click the reserve button to the right for each timeslot being reserved <span
                    style="color:red">(2)</span> and then when you have selected
            all timeslots you then click on the <span
                    class='normalbutton save'>Confirm Reservation</span> button <span
                    style="color:red">(3)</span>.</p>

        <div class="figure-holder">
            <img class="helpfigure" width="700"
                    src="images/reserving-timeslots-1.png">
        </div>
        <p class="figure-title">Reserving Timeslots</p>

    </div>

    <div class='subsection' id='calendar-viewbookings'>
        <h1>
            <a name="calendar-viewbookings">Viewing Bookings</a>
        </h1>
        <p>At any point in time if you wish to view the bookings already received on a specific Booking Type
            then you simply
            go to the Booking Types section and then click the <span
                    class='normalbutton editentry'>Edit</span> button for the booking type you want to see
            orders
            for, and you
            will be presented with the details for that Booking Type. On the bottom half of this screen you will
            see a
            table which lists all of the bookings that have be received so far for this specific booking type.
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="700"
                    src="images/booked-timeslots.png">
        </div>
        <p class="figure-title">Booked Timeslots</p>
        <p>
            In this table you can distinguish between normal bookings made by people as originally intended
            (i.e. booking status set to Confirmed), and
            those that you have marked as reserved (i.e. booking status set to Reserved).
        </p>
        <p><span class='highlight field label'>Bookings For a Specific Date</span> - In the table of bookings
            you
            can filter the displayed list to a specific date by clicking on the search box underneath the first
            column (i.e. see (1) in figure below), and then typing in the date you are interested in. Note you
            must
            enter the date using the format <strong>yyyy-mm-dd</strong>, an example of this is shown in the figure below.
            Also you can download the current listed set of bookings to Excel by clicking the small
            green icon above the table on the right (see (2) below).
        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="700"
                    src="images/search-booking.png">
        </div>
        <p class="figure-title">Getting Bookings For a Specific Date</p>
        <p><span class='highlight field label'>Viewing All Bookings</span> - you can also view and download a
            listing
            of all bookings across all booking types by clicking on the <strong>Booking Orders</strong> sub menu
            on the left.

        </p>
        <div class="figure-holder">
            <img class="helpfigure" width="700"
                    src="images/booked-orders.png">
        </div>
        <p class="figure-title">Viewing All Booked Orders</p>

        <h3>Booking Calendar View</h3>
        <p>We also provide a calendar based view of all bookings for a specific booking type, to access this
            view click the <strong>View Calendar</strong> button on the Booking Types page (see example screenshot below).</p>
        <div class="figure-holder">
            <img class="helpfigure" width="700"
                    src="images/view-booking-calendar-button.png">
        </div>
        <p class="figure-title">Booking Calendar View</p>

        <p>The screenshot below shows an example of the Calendar Booking View, with the booked slots shown in red and
            the free slots shown in blue.</p>
        <div class="figure-holder">
            <img class="helpfigure" width="700"
                    src="images/view-booking-calendar.png">
        </div>
        <p class="figure-title">Booking Calendar View</p>

    </div>

    <h1>
        <a name="calendar-viewbookings">Watch Short Videos</a>
    </h1>
    <div class='important-notice'>
        <table class="w-100">
            <tr>
                <td style='vertical-align:top;padding-right:20px;'>
                    <span style='font-size: 150%;padding-bottom:10px;' class='highlight title'>Introduction to Calendar Bookings and Booking Types - Part 1</span><br/>
                    <br/>This is part 1 of a series of videos that explain how you can use the Calendar Booking
                    functionality within
                    ItsPlainSailing. This first video explains Booking Types and the various options that are
                    available in using them.
                    <br><br><strong>Note:</strong> Click on image to start video
                </td>
                <td style='width: 320px;'>
                    <div class="figure-holder">
                        <a href="https://youtu.be/qNcFajmpTxM" target='_blank'><img
                                    class="helpfigure"
                                    width="300"
                                    src="images/add-menu-options.png"></a>
                    </div>
                </td>
            </tr>
        </table>

    </div>
    <p class="howto" id="howto13"></p>

    <div class='important-notice'>
        <table class="w-100">
            <tr>
                <td style='vertical-align:top;padding-right:20px;'>
                    <span style='font-size: 150%;padding-bottom:10px;' class='highlight title'>Introduction to Calendar Bookings and Booking Types - Part 2</span><br/>
                    <br/>This is part 2 of a series of videos that explain how you can use the Calendar
                    Booking functionality within ItsPlainSailing. This second video explains Calendars
                    and the various options that are available in using them.

                    <br><br><strong>Note:</strong> Click on image to start video

                </td>
                <td style='width: 320px;'>
                    <div class="figure-holder">
                        <a href="https://youtu.be/k3AoAcZ5hpI" target='_blank'><img
                                    class="helpfigure"
                                    width="300"
                                    src="images/add-menu-options.png"></a>
                    </div>
                </td>
            </tr>
        </table>


    </div>


</section>