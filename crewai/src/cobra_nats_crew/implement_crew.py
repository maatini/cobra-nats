"""Cobra NATS implementation crew — applies ranked actions 1, 3–10 (skip 2)."""

from __future__ import annotations

import os
from typing import Any

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task

from cobra_nats_crew.llm import build_llm
from cobra_nats_crew.paths import OUTPUT_DIR
from cobra_nats_crew.tools.factory import build_implement_tools


def _llm() -> LLM:
    return build_llm()


def _truthy(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


@CrewBase
class CobraNatsImplementCrew:
    """Sequential implementation crew. Writes source; never touches git remotes."""

    agents_config = "config/implement_agents.yaml"
    tasks_config = "config/implement_tasks.yaml"

    def __init__(self) -> None:
        self._tools: list[Any] | None = None

    def tools(self) -> list[Any]:
        if self._tools is None:
            self._tools = build_implement_tools()
        return self._tools

    def _agent(self, key: str, max_iter: int) -> Agent:
        return Agent(
            config=self.agents_config[key],
            tools=self.tools(),
            llm=_llm(),
            verbose=True,
            allow_delegation=False,
            max_iter=max_iter,
        )

    @agent
    def backend_engineer(self) -> Agent:
        return self._agent("backend_engineer", 30)

    @agent
    def qa_engineer(self) -> Agent:
        return self._agent("qa_engineer", 25)

    @agent
    def docs_writer(self) -> Agent:
        return self._agent("docs_writer", 15)

    @agent
    def performance_optimizer(self) -> Agent:
        return self._agent("performance_optimizer", 15)

    @agent
    def feature_planner(self) -> Agent:
        return self._agent("feature_planner", 12)

    @agent
    def implement_reporter(self) -> Agent:
        return self._agent("implement_reporter", 8)

    def _task(self, key: str, filename: str, context: list[Task] | None = None) -> Task:
        kwargs: dict[str, Any] = {
            "config": self.tasks_config[key],
            "output_file": str(OUTPUT_DIR / filename),
        }
        if context:
            kwargs["context"] = context
        return Task(**kwargs)

    @task
    def item_1_runtime_schemas(self) -> Task:
        return self._task("item_1_runtime_schemas", "implement-01-schemas.md")

    @task
    def item_3_nats_manager(self) -> Task:
        return self._task(
            "item_3_nats_manager",
            "implement-03-nats-manager.md",
            [self.item_1_runtime_schemas()],
        )

    @task
    def item_4_ssrf_monitoring(self) -> Task:
        return self._task(
            "item_4_ssrf_monitoring",
            "implement-04-ssrf.md",
            [self.item_1_runtime_schemas()],
        )

    @task
    def item_6_route_cleanup(self) -> Task:
        return self._task(
            "item_6_route_cleanup",
            "implement-06-cleanup.md",
            [self.item_3_nats_manager(), self.item_4_ssrf_monitoring()],
        )

    @task
    def item_5_lifecycle_tests(self) -> Task:
        return self._task(
            "item_5_lifecycle_tests",
            "implement-05-tests.md",
            [
                self.item_1_runtime_schemas(),
                self.item_3_nats_manager(),
                self.item_4_ssrf_monitoring(),
                self.item_6_route_cleanup(),
            ],
        )

    @task
    def item_7_playwright_isolation(self) -> Task:
        return self._task(
            "item_7_playwright_isolation",
            "implement-07-playwright.md",
            [self.item_5_lifecycle_tests()],
        )

    @task
    def item_8_docs(self) -> Task:
        return self._task(
            "item_8_docs",
            "implement-08-docs.md",
            [
                self.item_1_runtime_schemas(),
                self.item_3_nats_manager(),
                self.item_4_ssrf_monitoring(),
                self.item_6_route_cleanup(),
                self.item_5_lifecycle_tests(),
                self.item_7_playwright_isolation(),
            ],
        )

    @task
    def item_9_performance(self) -> Task:
        return self._task(
            "item_9_performance",
            "implement-09-performance.md",
            [self.item_8_docs()],
        )

    @task
    def item_10_roadmap(self) -> Task:
        return self._task(
            "item_10_roadmap",
            "implement-10-roadmap.md",
            [self.item_9_performance()],
        )

    @task
    def item_report(self) -> Task:
        return self._task(
            "item_report",
            "implement-00-report.md",
            [
                self.item_1_runtime_schemas(),
                self.item_3_nats_manager(),
                self.item_4_ssrf_monitoring(),
                self.item_6_route_cleanup(),
                self.item_5_lifecycle_tests(),
                self.item_7_playwright_isolation(),
                self.item_8_docs(),
                self.item_9_performance(),
                self.item_10_roadmap(),
            ],
        )

    @crew
    def crew(self) -> Crew:
        check_mode = _truthy("CREW_CHECK", "false")
        return Crew(
            agents=list(self.agents),
            tasks=self.tasks,
            process=Process.sequential,
            verbose=not check_mode,
            memory=False,
            planning=False,
            planning_llm=None,
            cache=False,
            tracing=False,
        )
