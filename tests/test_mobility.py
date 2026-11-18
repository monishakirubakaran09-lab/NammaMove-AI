import importlib.util
import sys
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('nammamove_backend', Path(__file__).resolve().parents[1] / 'backend' / 'main.py')
backend = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = backend
spec.loader.exec_module(backend)

class MobilityTests(unittest.TestCase):
    def setUp(self):
        backend.reset()

    def test_arrival_and_steps(self):
        result = backend.overview('indiranagar', 'majestic', '09:00')
        self.assertRegex(result['routes'][0]['arrival'], r'^\\d{2}:\\d{2}$'.replace('\\\\','\\'))
        self.assertEqual(len(result['journeys'][0]['steps']), 3)

    def test_incident_delay(self):
        backend.add_incident(backend.IncidentRequest(segment_id='indiranagar:ulsoor', kind='waterlogging'))
        data = backend.overview('indiranagar', 'ulsoor')
        self.assertTrue(any(r['incident_delay_minutes'] > 0 for r in data['routes'] if r['nodes'] == ['indiranagar', 'ulsoor']))
        self.assertEqual(data['incidents'][0]['penalty'], 17)

    def test_invalid_same_stop(self):
        with self.assertRaises(Exception):
            backend.overview('indiranagar', 'indiranagar')

if __name__ == '__main__': unittest.main()
