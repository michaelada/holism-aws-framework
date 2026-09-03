<?php
require_once("../inc/config.php");

global $_SESSION;

if (isset($_SESSION)) {

    $CURRENCYCODE_TO_TEXT = array(
        "eur" => "Euro",
        "gbp" => "Pounds"
    );

    $countrycode = strtolower($_SESSION[SESSION_NAME]['clubtype']['countrycode']);

    $currency = $CURRENCYCODE_TO_TEXT[strtolower($_SESSION[SESSION_NAME]['clubtype']['currencycode'])];
    $cents = $_SESSION[SESSION_NAME]['clubtype']['centscode'];
    $applicationfee = $_SESSION[SESSION_NAME]['clubtype']['applicationfee'];
    $ispremium = $_SESSION[SESSION_NAME]['premium'];
} else {
    $cents = "";
    $countrycode = "";
    $ispremium = false;
}
$ispremium = false;

$pcuk = false;
if(Capability::hasCapability(Capability::PCUK)) {
    $pcuk = true;
}

$sections = array();
$sections[] = array('id' => 'intro', 'name' => 'Introduction', 'icon' => 'fa-chevron-right');
$sections[] = array('id' => 'faq', 'name' => 'FAQ', 'icon' => 'fa-question-circle-o');
$sections[] = array('id' => 'events', 'name' => 'Events', 'icon' => 'fa-calendar-check-o');
if($pcuk) {
    $sections[] = array('id' => 'pcuk', 'name' => 'UK Pony Club', 'icon' => 'fa-certificate');    
}
$sections[] = array('id' => 'ticketing', 'name' => 'Ticketing', 'icon' => 'fa-qrcode');
$sections[] = array('id' => 'calendar', 'name' => 'Calendar Bookings', 'icon' => 'fa-calendar-check-o');
$sections[] = array('id' => 'membership', 'name' => 'Membership', 'icon' => 'fa-address-book-o');
$sections[] = array('id' => 'merchandise', 'name' => 'Merchandise', 'icon' => 'fa-shopping-bag');
$sections[] = array('id' => 'payments', 'name' => 'Payments', 'icon' => 'fa-calendar-check-o');
$sections[] = array('id' => 'notices', 'name' => 'Notice Boards', 'icon' => 'fa-newspaper-o');
$sections[] = array('id' => 'settings', 'name' => 'Settings', 'icon' => 'fa-gear');



?>

<!DOCTYPE html>
<html lang="en" class="full-height">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
    <meta name="description"
          content="Use Its Plain Sailing Online Payments to manage events, memberships, payments ... online in one place. For your Club, Society, Organisation, School... take the hassle out of collecting applications and credit card/ debit card payments for your events, membership renewals and so forth.">
    <meta name="author" content="Esker Software "/>
    <meta name="googlebot" content="noarchive"/>

    <meta name="keywords"
          content="online, payments, club, school, organisation, entry, event, ireland, credit card, debit card, membership, easy, equestrian, swim, run, cycle, gaa, rugby, hockey, tennis, soccer, athletics, golf"/>

    <title>Its Plain Sailing Online Help System</title>

    <link rel="icon" type="image/x-icon" href="/favicon.png">

    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css"/>

    <!-- <link  rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0-beta1/dist/css/bootstrap.min.css"integrity="sha384-0evHe/X+R7YkIZDRvuzKMRqM+OrBnVFBL6DOitfPri4tjfHxaWutUpFmBp4vmVor" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.3/font/bootstrap-icons.css"> -->
    
    <!-- Material Design Bootstrap -->
    <link href="<?php echo BASE_WEB_URL ?>/shared/css/bootstrap.min.css" rel="stylesheet"/>
    <link href="<?php echo BASE_WEB_URL ?>/shared/css/mdb.min.css" rel="stylesheet"/>

    <!-- Custom CSS -->
    <link href="<?php echo BASE_WEB_URL ?>/shared/css/help-style.css" rel="stylesheet"/>

    <style>
        .howto {
            padding-top: 30px;
        }
    </style>
</head>

<body id="page-top" cz-shortcut-listen="true" class="fixed-sn white-skin">
<header>
    <!-- SideNav slide-out button -->
    <!--    <a href="#" data-activates="slide-out" class="btn btn-primary p-3 button-collapse"><i class="fa fa-bars"></i></a>-->

    <!-- Sidebar navigation -->
    <div id="slide-out" class="side-nav sn-bg-1  fixed smooth-scroll">
        <ul class="custom-scrollbar">
            <div class="sidenav-bg mask-strong "></div>
           
            <!--Social-->
            <li><h4 class="text-dark text-center mt-2">Help&Support</h4></li>
            <!--/.Search Form-->
            <!-- Side navigation links -->
            <!--/.Search Form-->
            <!-- Side navigation links -->
            <li>
                <ul class="collapsible collapsible-accordion">
            <?php
                foreach($sections as $section) {
            ?>
                <li class="intro active">
                    <a class="collapsible-header waves-effect arrow-r active"><i
                                    class="fa <?php echo $section['icon'] ?>"></i> <?php echo $section['name']; ?><i
                                    class="fa fa-angle-down rotate-icon"></i></a>
                        <div class="collapsible-body">

            <?php
                    include("./sections/" . $section['id'] . "/sideindex.php");
            ?>
                    </div>
                </li>
            <?php
                }
            ?>

        </ul>
    </div>
    <!--/. Sidebar navigation -->            

    <nav class="navbar fixed-top navbar-toggleable-md navbar-expand-lg scrolling-navbar double-nav smooth-scroll">
        <!-- SideNav slide-out button -->
        <div class="float-left">
            <a href="#" data-activates="slide-out" class="button-collapse black-text"><i class="fa fa-bars"></i></a>
        </div>
        <!-- Breadcrumb-->
        <div class="breadcrumb-dn mr-auto">
            <p>ItsPlainSailing Online Help</p>
        </div>
        <ul class="nav navbar-nav nav-flex-icons ml-auto">
            <li class="nav-item">
                <a class="nav-link waves-effect waves-light" href="https://www.itsplainsailing.com/admin"><i
                            class="fa fa-home"></i>
                    <span class="clearfix d-none d-sm-inline-block">Home</span></a>
            </li>
            <li class="nav-item">
                <a class="nav-link waves-effect waves-light" href="#more-contactdetails"><i class="fa fa-envelope"></i>
                    <span class="clearfix d-none d-sm-inline-block">Contact</span></a>
            </li>
            <li class="nav-item">
                <a class="nav-link waves-effect waves-light" href="#more-contactdetails"><i
                            class="fa fa-comments-o"></i> <span class="clearfix d-none d-sm-inline-block">Support</span></a>
            </li>
            <li class="nav-item">
                <a class="nav-link waves-effect waves-light" href="#"><i class="fa fa-angle-double-up"></i> <span
                            class="clearfix d-none d-sm-inline-block">Top</span></a>
            </li>

        </ul>
    </nav>

    <main>
        <?php
                foreach($sections as $section) {
                    include("./sections/" . $section['id'] . "/body.php");
                }
        ?>
        <p class="pb-5"></p>
        <p class="pb-5"></p>
        <p class="pb-5"></p>
        <p class="pb-5"></p>
        <p class="pb-5"></p>
        <p class="pb-5"></p>
        <p class="pb-5"></p>
        <p class="pb-5"></p>
    </main>
    
    </header>
        <script type="text/javascript" src="<?php echo BASE_WEB_URL ?>/shared/js/jquery-3.2.1.min.js"></script>
        <script type="text/javascript" src="<?php echo BASE_WEB_URL ?>/shared/js/jquery.cookie.js"></script>
        <!-- Bootstrap tooltips -->
        <script type="text/javascript" src="<?php echo BASE_WEB_URL ?>/shared/js/popper.min.js"></script>
        <!-- Bootstrap core JavaScript -->
        <script type="text/javascript" src="<?php echo BASE_WEB_URL ?>/shared/js/bootstrap.min.js"></script>
        <!-- MDB core JavaScript -->
        <script type="text/javascript" src="<?php echo BASE_WEB_URL ?>/shared/js/mdb/mdb-help.min.js"></script>

        <script type="text/javascript">
        // SideNav Button Initialization
        $(".button-collapse").sideNav();
        var sideNavScrollbar = document.querySelector('.custom-scrollbar');
        Ps.initialize(sideNavScrollbar);

        var shorturl = 'itsplainsailing.com/org/';
        var shortcode = '<?php echo getClubShortCode(); ?>';
        var clubtype = <?php $clubtype = getClubType(); echo $clubtype['id']; ?>;
        $("span.clubshortcode").text(shortcode);
        $("span.cluburl").text(shorturl + shortcode);
        $("a.cluburl").attr('href', 'http://' + shorturl + shortcode);
        $("a.mailto").attr('href', 'mailto:support@eskersoft.com?subject=' + shortcode.toUpperCase() + " Query");

        if (clubtype != 1) {
            // hide ipc specific stuff
            $(".ipconly").hide();
        }

        if (clubtype != 18) {
            // hide ipc specific stuff
            $(".pcukonly").hide();
        }

        $("#slide-out ul.collapsible-accordion li ul li a").click(function () {
            var href = $(this).attr('href');
            var page = $(this).text();

            window.history.pushState(page, page, href);
        });
        </script>
    </body>
</html>
