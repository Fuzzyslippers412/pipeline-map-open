"""Population and weight regression checks; fixtures stay outside published data."""
import argparse
import csv
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

import workforce


class WorkforceChecks(unittest.TestCase):
    def test_acs_counts_use_all_workers_and_only_black_alone(self):
        weights = ('PWGTP', *(f'PWGTP{i}' for i in range(1, 81)))
        fields = ['AGEP', 'ESR', 'OCCP', 'RAC1P', 'SEX', *weights]
        records = [
            (42, 1, '3090', 2, 1, 10),  # Black male employed at work
            (48, 2, '3090', 2, 2, 20),  # Black female with job, temporarily absent
            (36, 1, '3090', 9, 1, 30),  # multiple races belong in denominator only
            (51, 3, '3090', 2, 1, 999),  # unemployed, previous occupation
            (39, 1, '3110', 2, 1, 999),  # physician assistant
        ]
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as z:
            for name, sample in [('psam_pusa.csv', records[:2]), ('psam_pusb.csv', records[2:])]:
                stream = io.StringIO()
                writer = csv.writer(stream)
                writer.writerow(fields)
                for age, esr, occ, race, sex, weight in sample:
                    writer.writerow([age, esr, occ, race, sex, *([weight] * 81)])
                z.writestr(name, stream.getvalue())
        with zipfile.ZipFile(archive) as z:
            totals = workforce.tabulate_acs(z, {'3090': 'physician'})['physician']
        self.assertEqual([row[:2] for row in totals], [[3, 60], [1, 10], [1, 20]])
        self.assertEqual([row[-1] for row in totals], [60, 10, 20])

    def test_ipums_break_and_basic_monthly_weight(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            mapping = root / 'mapping.csv'
            mapping.write_text('profession_id,occ2010,start_year,end_year,occupation_label\n'
                               'physician,3060,2002,2002,Physicians and surgeons\n'
                               'physician,3060,2003,2003,Physicians and surgeons\n')
            path = root / 'test.csv'
            header = 'YEAR,MONTH,CPSIDP,ASECFLAG,EMPSTAT,AGE,SEX,RACE,WTFINL,OCC2010\n'
            monthly = []
            for year in (2002, 2003):
                for month in range(1, 13):
                    flag = '2' if month == 3 else ''
                    monthly.extend(
                        f'{year},{month},{pid},{flag},10,50,{sex},{race},{weight},3060\n'
                        for pid, sex, race, weight in ((100, 1, 200, 10), (200, 2, 200, 20),
                                                      (300, 1, 100, 70))
                    )
            path.write_text(header + ''.join(monthly))
            args = argparse.Namespace(extract=path, mapping=mapping, title='Synthetic QA',
                                      citation_url='https://cps.ipums.org/', retrieved_on='2026-11-03')
            data = workforce.run_ipums(args)
            first, _, third, _ = data['series']
            self.assertEqual(first['weighted_denominator'], 100)
            self.assertEqual(first['value'], 10)
            self.assertEqual(first['unweighted_group_n'], 12)
            self.assertNotEqual(first['series_id'], third['series_id'])
            self.assertIn('single race recorded', first['definition'])
            self.assertIn('multiple race responses allowed', third['definition'])
            path.write_text(header + ''.join(monthly[:-3]))
            with self.assertRaisesRegex(ValueError, 'missing Basic Monthly'):
                workforce.run_ipums(args)
            path.write_text(header + ''.join(monthly).replace(',3,100,2,', ',3,100,1,', 1))
            with self.assertRaisesRegex(ValueError, 'ASEC'):
                workforce.run_ipums(args)


if __name__ == '__main__':
    unittest.main()
