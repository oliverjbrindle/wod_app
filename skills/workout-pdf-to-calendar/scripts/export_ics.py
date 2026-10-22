#!/usr/bin/env python3
"""Export reviewed, dated workout JSON to RFC 5545 iCalendar. Stdlib only."""
import argparse
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import uuid


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value, integer=False, zero=False):
    try:
        n = Decimal(value)
    except InvalidOperation:
        raise ValueError(f"Invalid number: {value}") from None
    require(n.is_finite() and (n >= 0 if zero else n > 0), f"Invalid number: {value}")
    require(not integer or n == n.to_integral_value(), f"Expected integer: {value}")


def exercise(line, legacy=False):
    require(isinstance(line, str) and line.strip() and not any(c in line for c in '\r\n'),
            'Each exercise must be one nonempty line')
    fields = [v.strip() for v in line.split(',')]
    kind = fields[0]
    if kind not in ('lift', 'cardio'):
        require(legacy, 'Unknown exercise notation; legacy notation requires confirmation')
        return
    require(len(fields) == (6 if kind == 'lift' else 7), f'Wrong field count: {line}')
    require(bool(fields[1]), 'Missing exercise name')
    number(fields[2], integer=True)
    if kind == 'lift':
        number(fields[3], integer=True)
        number(fields[4], zero=True)
        require(fields[5] in ('kg', 'lb', '% of Max', '% of Bodyweight'), 'Invalid lift unit')
    else:
        units = {'time': ('min', 'sec', 'hr'), 'distance': ('km', 'm', 'mi'), 'calories': ('kcal',)}
        require(fields[3] in units and fields[5] in units[fields[3]], 'Invalid cardio measurement/unit')
        number(fields[4])
        require(fields[6] in ('1', '2', '3', '4', '5'), 'Zone must be 1–5')


def temporal(value):
    require(isinstance(value, str), 'Date must be a string')
    if len(value) == 10:
        return date.fromisoformat(value)
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timed sessions require a UTC offset')
    return result.astimezone(timezone.utc)


def stamp(name, value):
    if isinstance(value, datetime):
        return name + ':' + value.strftime('%Y%m%dT%H%M%SZ')
    return name + ';VALUE=DATE:' + value.strftime('%Y%m%d')


def escape(value):
    return value.replace('\\', '\\\\').replace('\r\n', '\n').replace('\r', '\n').replace('\n', '\\n').replace(';', '\\;').replace(',', '\\,')


def fold(line):
    parts, current = [], ''
    for char in line:
        if len((current + char).encode('utf-8')) > 75:
            parts.append(current)
            current = ' '
        current += char
    parts.append(current)
    return '\r\n'.join(parts)


def export(sessions):
    require(isinstance(sessions, list) and 0 < len(sessions) <= 2000, 'Expected 1–2,000 sessions')
    counts = Counter()
    lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workout PDF to Calendar//EN', 'CALSCALE:GREGORIAN']
    now = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    for session in sessions:
        require(isinstance(session, dict), 'Session must be an object')
        require(not any(key in session for key in ('rrule', 'RRULE', 'recurrence')), 'Expand recurrence first')
        title = session.get('title')
        require(isinstance(title, str) and title.strip(), 'Missing workout title')
        desc = session.get('description')
        require(isinstance(desc, list) and desc, 'Missing exercises')
        for line in desc:
            exercise(line, session.get('legacy_confirmed') is True)
        if 'series_id' in session:
            series = session['series_id']
            require(isinstance(series, str) and series.strip(), 'Invalid series_id')
            counts[series] += 1
            require(counts[series] <= 366, 'Series exceeds 366 occurrences')
        start = temporal(session['start'])
        end = temporal(session['end']) if 'end' in session else None
        if end is None and not isinstance(start, datetime):
            end = start + timedelta(days=1)
        if end is not None:
            require(type(start) is type(end) and end > start, 'End must follow start and use the same date type')
        lines.extend(['BEGIN:VEVENT', 'UID:' + str(uuid.uuid4()) + '@workout-pdf-to-calendar',
                      'DTSTAMP:' + now, stamp('DTSTART', start)])
        if end is not None:
            lines.append(stamp('DTEND', end))
        lines.extend(['SUMMARY:' + escape(title), 'DESCRIPTION:' + escape('\n'.join(desc)), 'END:VEVENT'])
    lines.append('END:VCALENDAR')
    return ('\r\n'.join(fold(line) for line in lines) + '\r\n').encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    try:
        result = export(json.loads(args.input.read_text(encoding='utf-8')))
    except (ValueError, KeyError, TypeError) as exc:
        parser.error(str(exc))
    args.output.write_bytes(result)
    print(f'Created {args.output}')


if __name__ == '__main__':
    main()
