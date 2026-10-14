from datetime import datetime, date, timezone
import pytest
from app.travel_time import validate_future_departure

NOW = datetime(2026, 10, 14, 20, 45, tzinfo=timezone.utc)  # 22:45 in Brussels


def test_refuses_past_day():
    with pytest.raises(ValueError, match='toekomstige'):
        validate_future_departure(date(2026,10,13),'09:00', NOW)


def test_refuses_past_time_same_day():
    with pytest.raises(ValueError, match='vertrektijd'):
        validate_future_departure(date(2026,10,14),'08:00', NOW)


def test_allows_later_day_and_time():
    assert validate_future_departure(date(2026,10,15),'08:00', NOW).hour == 8
    assert validate_future_departure(date(2026,10,14),'22:50', NOW).minute == 50
