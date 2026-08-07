import launch
import launch.actions


def generate_launch_description():
    """Deprecated entry point — do not start an alternate bridge here.

    This launch file used to start the rws_server bridge on port 5001. It is now
    a no-op; the tailnet-fronted cockpit bridge (ugv_cockpit/rosbridge.launch.py)
    is the only supported browser path.
    """
    return launch.LaunchDescription([
        launch.actions.LogInfo(
            msg='vizanti_rws.launch.py is deprecated and does nothing. '
                'Use ugv_cockpit for the cockpit bridge.'
        ),
    ])


if __name__ == '__main__':
    launch.main()
