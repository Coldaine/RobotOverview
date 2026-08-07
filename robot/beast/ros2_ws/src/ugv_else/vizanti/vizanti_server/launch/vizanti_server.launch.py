import launch
import launch.actions


def generate_launch_description():
    """Deprecated entry point — do not start a stock rosbridge here.

    This launch file used to start rosbridge_server + rosapi on 0.0.0.0:5001 with
    no topic/service globs, which bypassed the cockpit access controls. It is now
    a no-op; the tailnet-fronted cockpit bridge (ugv_cockpit/rosbridge.launch.py)
    is the only supported browser path.
    """
    return launch.LaunchDescription([
        launch.actions.LogInfo(
            msg='vizanti_server.launch.py is deprecated and does nothing. '
                'Use ugv_cockpit for the cockpit bridge.'
        ),
    ])


if __name__ == '__main__':
    launch.main()
