import time

class PID:
    def __init__(self, kp, ki, kd, output_limits, tolerance):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.integral = 0.0
        self.prev_error = 0.0
        self.prev_time = None
        self.output_limits = output_limits
        self.tolerance = tolerance  

    def compute(self, setpoint, measurement):
        error = setpoint - measurement
        
        if abs(error) <= self.tolerance:
            self.integral = 0.0
            self.prev_error = 0.0
            self.prev_time = time.time()
            return 0.0

        now = time.time()
        dt = 0.0 if self.prev_time is None else now - self.prev_time

        self.integral += error * dt
        derivative = 0.0 if dt == 0 else (error - self.prev_error) / dt

        output = self.kp * error + self.ki * self.integral + self.kd * derivative
        output = max(self.output_limits[0], min(self.output_limits[1], output))

        self.prev_error = error
        self.prev_time = now
        return output