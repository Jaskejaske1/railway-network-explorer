"""Validate requested journeys against Europe/Brussels local clock."""
from datetime import datetime, date as Date, time as Time
from zoneinfo import ZoneInfo

BELGIUM = ZoneInfo('Europe/Brussels')


def validate_future_departure(day: Date, hhmm: str, now: datetime | None = None):
    try:
        hour, minute = map(int, hhmm.split(':'))
        requested_time = Time(hour=hour, minute=minute)
    except (ValueError, TypeError, AttributeError) as error:
        raise ValueError('Ongeldige tijd: gebruik UU:MM') from error
    now = now or datetime.now(BELGIUM)
    local_now = now.astimezone(BELGIUM)
    if day < local_now.date():
        raise ValueError('Kies vandaag of een toekomstige reisdatum')
    if day == local_now.date() and requested_time <= local_now.time().replace(second=0, microsecond=0):
        raise ValueError('De vertrektijd is voorbij; kies een latere tijd')
    return requested_time
