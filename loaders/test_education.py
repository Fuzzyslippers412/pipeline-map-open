import unittest
from copy import deepcopy
from unittest.mock import patch

import aamc_facts
import aba_509
import bls_table11
from refresh_education import validate


class EducationChecks(unittest.TestCase):
    def test_sources_and_definitions_are_mandatory(self):
        bundle = aamc_facts.load(download=False, strict=False, warnings=[])
        validate(bundle)
        for field in ("definition","source_id"):
            broken = deepcopy(bundle)
            broken["series"][0][field] = ""
            with self.assertRaises(ValueError):
                validate(broken)

    def test_medical_denominator_and_order(self):
        bundle = aamc_facts.load(download=False, strict=False, warnings=[])
        men = {p["year"]:p for p in bundle["series"] if p["group"] == "black_male"}
        # A-9 (2016 edition) reports women first; A-12 includes another/unreported gender.
        self.assertEqual((men[2013]["numerator"], men[2013]["denominator"]), (500,20055))
        self.assertEqual(men[2020]["denominator"],22239)
        self.assertNotEqual(men[2019]["series_id"],men[2020]["series_id"])

    def test_law_residency_change_breaks_the_line(self):
        bundle = aba_509.load(download=False, strict=False, warnings=[], last_year=2025)
        validate(bundle)
        men = {p["year"]:p for p in bundle["series"] if p["group"] == "black_male"}
        self.assertNotEqual(men[2023]["series_id"],men[2024]["series_id"])
        self.assertEqual((men[2025]["numerator"],men[2025]["denominator"]), (1044,43722))

    def test_replay_preserves_checked_date_and_marginals_never_become_crosses(self):
        with patch.object(bls_table11, "get_bytes", side_effect=OSError("unavailable")), patch.object(bls_table11,"TODAY","2099-01-01"):
            messages = []
            bundle = bls_table11.load(download=True,strict=False,warnings=messages)
            self.assertEqual(bundle["series"], [])
            self.assertEqual(bundle["sources"][0]["retrieved_on"],bls_table11.REVIEWED_ON)
            self.assertTrue(messages)
            with self.assertRaises(OSError):
                bls_table11.load(download=True,strict=True,warnings=[])


if __name__ == "__main__":
    unittest.main()
